/**
 * Files and voice notes attached to a knowledge record.
 *
 * Bytes are kept inside the record as base64 data URLs. That keeps a local
 * backup a single portable file and means an attachment cannot exist without
 * its record, but it also means storage is finite: browser localStorage is
 * typically 5 MB. The limits below are deliberately conservative and are
 * enforced before anything is written.
 */
import type { AttachmentKind, KnowledgeAttachment } from './types';

export const ATTACHMENT_LIMITS = {
  /** Attachments per record, files and recordings together. */
  maxPerRecord: 6,
  /** One upload. Recordings are much smaller and share the same ceiling. */
  maxFileBytes: 1_500_000,
  /** All attachment bytes on one record, before base64 expansion. */
  maxRecordBytes: 2_500_000,
  /**
   * All attachment bytes on the node. Browser storage is usually 5 MB; base64
   * adds a third, so this stays well below it to leave room for the records.
   */
  maxNodeBytes: 3_000_000,
  maxTranscriptChars: 60_000,
  maxRecordingSeconds: 600,
} as const;

export function newAttachmentId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `att-${random}`;
}

/** Records created before attachments existed have no field at all. */
export function attachmentsOf(record: { attachments?: KnowledgeAttachment[] }): KnowledgeAttachment[] {
  return record.attachments ?? [];
}

export function isDataUrl(value: string): boolean {
  return /^data:[^,]*;base64,/i.test(value);
}

/** Decoded byte length of a base64 data URL. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  if (!/;base64/i.test(dataUrl.slice(0, comma))) return lengthInBytes(dataUrl.slice(comma + 1));
  const payload = dataUrl.slice(comma + 1).replace(/\s/g, '');
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function lengthInBytes(text: string): number {
  return typeof TextEncoder === 'undefined' ? text.length : new TextEncoder().encode(text).length;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 1 : 0)} kB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}

export function attachmentBytes(attachments: KnowledgeAttachment[]): number {
  return attachments.reduce((total, attachment) => total + attachment.size, 0);
}

/** Bytes held by every attachment on the node, across all records. */
export function nodeAttachmentBytes(
  records: { attachments?: KnowledgeAttachment[] }[],
): number {
  return records.reduce((total, record) => total + attachmentBytes(record.attachments ?? []), 0);
}

/** Short, readable type label for a file or recording. */
export function attachmentTypeLabel(attachment: Pick<KnowledgeAttachment, 'kind' | 'mime' | 'name'>): string {
  if (attachment.kind === 'recording') return 'Voice note';
  const mime = attachment.mime.toLowerCase();
  const extension = attachment.name.includes('.')
    ? attachment.name.split('.').pop()!.toUpperCase().slice(0, 5)
    : '';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Image';
  if (mime.startsWith('audio/')) return 'Audio';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('text/csv') || mime === 'application/csv') return 'CSV';
  if (mime === 'application/json') return 'JSON';
  if (mime.startsWith('text/')) return 'Text';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'Spreadsheet';
  if (mime.includes('word') || mime.includes('document')) return 'Document';
  if (mime.includes('zip') || mime.includes('compressed')) return 'Archive';
  if (extension) return extension;
  return attachment.mime || 'File';
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Strip control characters and path separators from a user-supplied name. */
export function safeFileName(name: string, fallback = 'attachment'): string {
  const cleaned = name
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]+/g, '-')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

/**
 * Human-readable reason an attachment cannot be added, or null when it fits.
 * `incoming` is everything already on the record, including the new item.
 */
export function attachmentLimitError(
  incoming: KnowledgeAttachment[],
  limits = ATTACHMENT_LIMITS,
): string | null {
  if (incoming.length > limits.maxPerRecord) {
    return `A record can hold ${limits.maxPerRecord} files and recordings. Remove one before adding another.`;
  }
  for (const attachment of incoming) {
    if (attachment.size > limits.maxFileBytes) {
      return `“${attachment.name}” is ${formatBytes(attachment.size)}. The limit for one file is ${formatBytes(limits.maxFileBytes)}.`;
    }
  }
  const total = attachmentBytes(incoming);
  if (total > limits.maxRecordBytes) {
    return `These attachments total ${formatBytes(total)}. The limit for one record is ${formatBytes(limits.maxRecordBytes)}.`;
  }
  return null;
}

/**
 * Coerce untrusted attachment data (local storage, an imported backup) into
 * something the app can render, dropping entries whose bytes are missing.
 */
export function normaliseAttachments(value: unknown): KnowledgeAttachment[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const attachments: KnowledgeAttachment[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<KnowledgeAttachment>;
    if (typeof candidate.dataUrl !== 'string' || !isDataUrl(candidate.dataUrl)) continue;
    if (typeof candidate.name !== 'string') continue;
    const id = typeof candidate.id === 'string' && candidate.id ? candidate.id : newAttachmentId();
    if (seen.has(id)) continue;
    seen.add(id);
    const kind: AttachmentKind = candidate.kind === 'recording' ? 'recording' : 'file';
    const transcript =
      candidate.transcript &&
      typeof candidate.transcript.text === 'string' &&
      candidate.transcript.text.trim()
        ? {
            text: candidate.transcript.text.slice(0, ATTACHMENT_LIMITS.maxTranscriptChars),
            provider: String(candidate.transcript.provider ?? 'unknown'),
            model: String(candidate.transcript.model ?? 'unknown'),
            at: String(candidate.transcript.at ?? ''),
          }
        : undefined;
    attachments.push({
      id,
      name: safeFileName(candidate.name),
      mime: typeof candidate.mime === 'string' ? candidate.mime.slice(0, 120) : '',
      size: dataUrlBytes(candidate.dataUrl),
      kind,
      addedAt: typeof candidate.addedAt === 'string' ? candidate.addedAt : new Date().toISOString(),
      dataUrl: candidate.dataUrl,
      durationSeconds:
        typeof candidate.durationSeconds === 'number' && candidate.durationSeconds > 0
          ? Math.round(candidate.durationSeconds)
          : undefined,
      transcript,
    });
  }
  return attachments;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The file could not be read.'));
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('The file could not be read.'));
    reader.readAsDataURL(blob);
  });
}

export async function fileToAttachment(file: File): Promise<KnowledgeAttachment> {
  if (file.size > ATTACHMENT_LIMITS.maxFileBytes) {
    throw new Error(
      `“${safeFileName(file.name)}” is ${formatBytes(file.size)}. The limit for one file is ${formatBytes(ATTACHMENT_LIMITS.maxFileBytes)}.`,
    );
  }
  const dataUrl = await readAsDataUrl(file);
  return {
    id: newAttachmentId(),
    name: safeFileName(file.name),
    mime: file.type || 'application/octet-stream',
    size: file.size,
    kind: 'file',
    addedAt: new Date().toISOString(),
    dataUrl,
  };
}

export async function recordingToAttachment(
  blob: Blob,
  durationSeconds: number,
  at = new Date(),
): Promise<KnowledgeAttachment> {
  const dataUrl = await readAsDataUrl(blob);
  const stamp = at.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const extension = blob.type.includes('mp4')
    ? 'm4a'
    : blob.type.includes('ogg')
      ? 'ogg'
      : 'webm';
  return {
    id: newAttachmentId(),
    name: `voice-note-${stamp}.${extension}`,
    mime: blob.type || 'audio/webm',
    size: blob.size,
    kind: 'recording',
    addedAt: at.toISOString(),
    dataUrl,
    durationSeconds: Math.max(1, Math.round(durationSeconds)),
  };
}
