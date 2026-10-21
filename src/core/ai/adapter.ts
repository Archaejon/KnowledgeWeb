/**
 * Optional AI adapter boundary.
 *
 * The application never sends a corpus to a provider directly. Callers must
 * pass records that have already passed the access engine, and adapters must
 * not fetch additional records. The interface is deliberately small so a local
 * Ollama instance, another local runtime, or no adapter at all can be used
 * without touching community or knowledge features.
 */
import type { KnowledgeRecord } from '../types';

export interface AiRecord {
  id: string;
  title: string;
  body: string;
  tags: string[];
  authorName: string;
}

export interface AiCitation {
  id: string;
  title: string;
}

export interface AiAnswer {
  text: string;
  citations: AiCitation[];
  model: string;
  provider: string;
  elapsedMs: number;
}

export interface AiRunOptions {
  signal?: AbortSignal;
  timeoutMs: number;
  authorName: (id: string) => string;
}

export interface AiProbeResult {
  ok: boolean;
  detail: string;
  models: string[];
}

export interface AiAdapter {
  readonly id: string;
  readonly label: string;
  probe(options: { signal?: AbortSignal; timeoutMs: number }): Promise<AiProbeResult>;
  ask(
    question: string,
    records: KnowledgeRecord[],
    options: AiRunOptions,
  ): Promise<AiAnswer>;
}

/**
 * Convert authorised records into the minimal shape used by prompts.
 * Transcribed speech is readable text on the record, so it travels with the
 * body when the viewer may already read that record.
 */
export function toAiRecords(
  records: KnowledgeRecord[],
  authorName: (id: string) => string,
): AiRecord[] {
  return records.map((record) => {
    const transcripts = (record.attachments ?? [])
      .filter((attachment) => attachment.transcript?.text)
      .map((attachment) => `Transcript of ${attachment.name}: ${attachment.transcript!.text}`)
      .join('\n\n');
    return {
      id: record.id,
      title: record.title,
      body: transcripts ? `${record.body}\n\n${transcripts}` : record.body,
      tags: record.tags,
      authorName: authorName(record.authorId),
    };
  });
}
