/**
 * Speech-to-text boundary.
 *
 * The app has no bundled speech model and never sends audio anywhere by
 * default. When the optional AI settings include a local OpenAI-compatible
 * transcription endpoint (whisper.cpp's server, faster-whisper, LocalAI and
 * similar all speak this shape), a recording can be transcribed on demand.
 *
 * Only the selected recording is sent, to the endpoint the operator configured.
 * Nothing is sent automatically, and an answer is only stored when the author
 * asks for it.
 */
import type { AiSettings } from '../types';
import { isSafeHttpUrl } from '../validation';

export interface TranscriptionResult {
  text: string;
  provider: string;
  model: string;
}

export interface TranscriptionInput {
  /** The recording itself, as stored on the record. */
  dataUrl: string;
  mime: string;
  name: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface Transcriber {
  readonly id: string;
  readonly label: string;
  readonly model: string;
  readonly endpoint: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export function transcriptionEndpoint(ai: AiSettings): string {
  return (ai.transcriptionEndpoint ?? '').trim();
}

export function transcriptionModel(ai: AiSettings): string {
  return (ai.transcriptionModel ?? '').trim();
}

/** True only when the operator has pointed the app at a speech service. */
export function isTranscriptionConfigured(ai: AiSettings): boolean {
  const endpoint = transcriptionEndpoint(ai);
  return Boolean(
    ai.enabled && endpoint && transcriptionModel(ai) && isSafeHttpUrl(endpoint),
  );
}

/** Short, user-facing explanation of why transcription is unavailable. */
export function transcriptionStatus(ai: AiSettings): { available: boolean; reason: string } {
  const endpoint = transcriptionEndpoint(ai);
  const model = transcriptionModel(ai);
  if (!ai.enabled) {
    return {
      available: false,
      reason: 'Transcription is off because the optional AI adapter is disabled. Audio stays on this node.',
    };
  }
  if (!endpoint || !model) {
    return {
      available: false,
      reason:
        'No speech-to-text service is configured. Add a local Whisper-compatible endpoint in Node settings to transcribe recordings.',
    };
  }
  if (!isSafeHttpUrl(endpoint)) {
    return {
      available: false,
      reason: 'The configured transcription endpoint is not a valid http or https URL.',
    };
  }
  return { available: true, reason: `Audio will be sent only to ${endpoint}.` };
}

class WhisperCompatibleTranscriber implements Transcriber {
  readonly id = 'whisper-compatible';

  constructor(
    readonly endpoint: string,
    readonly model: string,
  ) {
    this.label = 'Local speech-to-text';
  }

  readonly label: string;

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const controller = new AbortController();
    const abort = () => controller.abort(new DOMException('Cancelled', 'AbortError'));
    if (input.signal?.aborted) abort();
    input.signal?.addEventListener('abort', abort, { once: true });
    const timer = window.setTimeout(
      () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
      input.timeoutMs,
    );

    try {
      const blob = await (await fetch(input.dataUrl)).blob();
      const form = new FormData();
      form.append('file', new File([blob], input.name, { type: input.mime }), input.name);
      form.append('model', this.model);
      form.append('response_format', 'json');

      let response: Response;
      try {
        response = await fetch(this.endpoint, {
          method: 'POST',
          body: form,
          signal: controller.signal,
        });
      } catch (error) {
        throw new Error(explainFetchError(error));
      }

      if (!response.ok) {
        throw new Error(
          `The speech service answered HTTP ${response.status}. Check the endpoint and model, and that the service allows this browser origin (CORS).`,
        );
      }

      const payload = (await response.json().catch(() => null)) as { text?: unknown } | null;
      const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
      if (!text) {
        throw new Error('The speech service returned no text. The recording may be silent or too short.');
      }
      return { text, provider: this.label, model: this.model };
    } finally {
      window.clearTimeout(timer);
      input.signal?.removeEventListener('abort', abort);
    }
  }
}

function explainFetchError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'TimeoutError') return 'The speech service did not respond in time.';
    if (error.name === 'AbortError') return 'Transcription cancelled.';
  }
  if (error instanceof TypeError) {
    return 'Could not reach the speech-to-text service. Is it running and allowing this browser origin?';
  }
  return error instanceof Error ? error.message : 'Transcription failed.';
}

/** Returns null when nothing is configured; the UI then explains why. */
export function createTranscriber(ai: AiSettings): Transcriber | null {
  if (!isTranscriptionConfigured(ai)) return null;
  return new WhisperCompatibleTranscriber(transcriptionEndpoint(ai), transcriptionModel(ai));
}
