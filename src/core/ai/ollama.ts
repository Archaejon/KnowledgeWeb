import type { KnowledgeRecord } from '../types';
import type { AiAdapter, AiAnswer, AiProbeResult, AiRunOptions } from './adapter';

const SYSTEM_PROMPT = `You are a careful research assistant for a small, consent-based community knowledge node.
You may use ONLY the authorised records supplied below. Do not use outside knowledge and do not invent records.
Cite every substantive claim with the exact marker [record:ID] using the IDs provided.
If the records do not answer the question, say so plainly and describe what is missing.
Distinguish observations from interpretations. Keep the answer under 250 words.`;

function normaliseEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outer?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort(new DOMException('Cancelled', 'AbortError'));
  if (outer?.aborted) abort();
  outer?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(
    () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
    timeoutMs,
  );
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    outer?.removeEventListener('abort', abort);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'TimeoutError') return 'The local model did not respond in time.';
    if (error.name === 'AbortError') return 'Request cancelled.';
  }
  if (error instanceof TypeError) {
    return 'Could not reach the local model. Is Ollama running and allowing this browser origin?';
  }
  return error instanceof Error ? error.message : 'Unknown model error.';
}

/** Rank and trim the authorised corpus so a small local model gets useful context. */
export function selectContext(records: KnowledgeRecord[], question: string, maxChars = 9000): KnowledgeRecord[] {
  const words = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2);
  const scored = records.map((record) => {
    const haystack = `${record.title} ${record.tags.join(' ')} ${record.body}`.toLowerCase();
    const score = words.reduce((sum, word) => sum + (haystack.includes(word) ? 1 : 0), 0);
    return { record, score };
  });
  scored.sort(
    (a, b) => b.score - a.score || b.record.updatedAt.localeCompare(a.record.updatedAt),
  );
  const selected: KnowledgeRecord[] = [];
  let used = 0;
  for (const { record } of scored) {
    const cost = record.title.length + Math.min(record.body.length, 2200) + 80;
    if (selected.length > 0 && used + cost > maxChars) continue;
    selected.push(record);
    used += cost;
    if (used >= maxChars) break;
  }
  return selected;
}

export class OllamaAdapter implements AiAdapter {
  readonly id = 'ollama';
  readonly label = 'Ollama (local)';

  constructor(
    private readonly endpoint: string,
    private readonly model: string,
  ) {}

  private base(): string {
    return normaliseEndpoint(this.endpoint);
  }

  async probe({ signal, timeoutMs }: { signal?: AbortSignal; timeoutMs: number }): Promise<AiProbeResult> {
    try {
      const response = await fetchWithTimeout(`${this.base()}/api/tags`, { method: 'GET' }, timeoutMs, signal);
      if (!response.ok) {
        return {
          ok: false,
          detail: `Ollama answered with HTTP ${response.status}. If this is a browser origin issue, start Ollama with an allowed OLLAMA_ORIGINS value.`,
          models: [],
        };
      }
      const body = (await response.json()) as { models?: { name?: string }[] };
      const models = (body.models ?? [])
        .map((model) => model.name)
        .filter((name): name is string => Boolean(name));
      return {
        ok: true,
        detail:
          models.length === 0
            ? 'Ollama is reachable, but no models are installed. This app will not download one for you.'
            : `Ollama is reachable. ${models.length} local model${models.length === 1 ? '' : 's'} available.`,
        models,
      };
    } catch (error) {
      return { ok: false, detail: errorMessage(error), models: [] };
    }
  }

  async ask(
    question: string,
    records: KnowledgeRecord[],
    options: AiRunOptions,
  ): Promise<AiAnswer> {
    const started = performance.now();
    const context = selectContext(records, question);
    if (context.length === 0) {
      return {
        text: 'There are no authorised records available to answer this question.',
        citations: [],
        model: this.model,
        provider: this.label,
        elapsedMs: Math.round(performance.now() - started),
      };
    }
    const contextText = context
      .map(
        (record) =>
          `[record:${record.id}] ${record.title}\nAuthor: ${options.authorName(record.authorId)}\nTags: ${record.tags.join(', ')}\n${record.body.slice(0, 2400)}`,
      )
      .join('\n\n---\n\n');

    const response = await fetchWithTimeout(
      `${this.base()}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
          options: { temperature: 0.2, num_predict: 500 },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Authorised records (the complete set you may use):\n\n${contextText}\n\nQuestion: ${question}`,
            },
          ],
        }),
      },
      options.timeoutMs,
      options.signal,
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `The model “${this.model}” was not found on this Ollama instance. Choose an installed model in Node settings.`,
        );
      }
      throw new Error(`Ollama returned HTTP ${response.status}.`);
    }
    const body = (await response.json()) as {
      message?: { content?: string };
      response?: string;
    };
    const text = (body.message?.content ?? body.response ?? '').trim();
    if (!text) throw new Error('The local model returned an empty answer.');

    const citations: AiAnswer['citations'] = [];
    const pattern = /\[record:([a-zA-Z0-9-]+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const record = context.find((item) => item.id === match?.[1]);
      if (record && !citations.some((citation) => citation.id === record.id)) {
        citations.push({ id: record.id, title: record.title });
      }
    }

    return {
      text,
      citations,
      model: this.model,
      provider: this.label,
      elapsedMs: Math.round(performance.now() - started),
    };
  }
}
