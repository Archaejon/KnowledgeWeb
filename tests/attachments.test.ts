import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_LIMITS,
  attachmentBytes,
  attachmentLimitError,
  attachmentTypeLabel,
  dataUrlBytes,
  formatBytes,
  formatDuration,
  nodeAttachmentBytes,
  normaliseAttachments,
  safeFileName,
} from '../src/core/attachments';
import { createTranscriber, transcriptionStatus } from '../src/core/ai/transcribe';
import { createSampleData } from '../src/core/sample';
import { searchKnowledge } from '../src/core/search';
import { MemoryStorageAdapter } from '../src/core/storage';
import { NodeStore } from '../src/core/store';
import type { AiSettings, KnowledgeAttachment } from '../src/core/types';

const DATA_URL = 'data:text/plain;base64,aGVsbG8='; // "hello", 5 bytes

function attachment(overrides: Partial<KnowledgeAttachment> = {}): KnowledgeAttachment {
  return {
    id: 'att-1',
    name: 'notes.txt',
    mime: 'text/plain',
    size: 5,
    kind: 'file',
    addedAt: '2026-01-01T00:00:00.000Z',
    dataUrl: DATA_URL,
    ...overrides,
  };
}

function aiSettings(overrides: Partial<AiSettings> = {}): AiSettings {
  return {
    enabled: false,
    provider: 'none',
    endpoint: '',
    model: '',
    timeoutMs: 8000,
    ...overrides,
  };
}

describe('attachment accounting', () => {
  it('formats byte sizes and durations for people', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(950)).toBe('950 B');
    expect(formatBytes(2400)).toBe('2.4 kB');
    expect(formatBytes(1_500_000)).toBe('1.5 MB');
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('reads the decoded size out of a base64 data URL', () => {
    expect(dataUrlBytes(DATA_URL)).toBe(5);
    // Padding is not part of the payload.
    expect(dataUrlBytes('data:text/plain;base64,YQ==')).toBe(1);
    expect(dataUrlBytes('data:text/plain,hello')).toBe(5);
    expect(dataUrlBytes('not-a-data-url')).toBe(0);
  });

  it('labels common file types without relying on the extension alone', () => {
    expect(attachmentTypeLabel(attachment({ name: 'a.bin' }))).toBe('Text');
    expect(attachmentTypeLabel(attachment({ name: 'scan.pdf', mime: 'application/pdf' }))).toBe('PDF');
    expect(attachmentTypeLabel(attachment({ name: 'plot.csv', mime: 'text/csv' }))).toBe('CSV');
    expect(attachmentTypeLabel(attachment({ name: 'unknown.xyz', mime: '' }))).toBe('XYZ');
    expect(
      attachmentTypeLabel(attachment({ kind: 'recording', name: 'voice.webm', mime: 'audio/webm' })),
    ).toBe('Voice note');
  });

  it('strips path separators and control characters from names', () => {
    expect(safeFileName('../../etc/passwd')).toBe('..-..-etc-passwd');
    expect(safeFileName('  report\u0000.pdf  ')).toBe('report.pdf');
    expect(safeFileName('   ', 'attachment')).toBe('attachment');
  });

  it('rejects too many files, oversized files and oversized records', () => {
    const tooMany = Array.from({ length: ATTACHMENT_LIMITS.maxPerRecord + 1 }, (_, index) =>
      attachment({ id: `att-${index}` }),
    );
    expect(attachmentLimitError(tooMany)).toMatch(/can hold/);

    const tooBig = [attachment({ size: ATTACHMENT_LIMITS.maxFileBytes + 1 })];
    expect(attachmentLimitError(tooBig)).toMatch(/limit for one file/);

    const total = Array.from({ length: 3 }, (_, index) =>
      attachment({ id: `big-${index}`, size: 1_000_000 }),
    );
    expect(attachmentLimitError(total)).toMatch(/limit for one record/);

    expect(attachmentLimitError([attachment()])).toBeNull();
  });

  it('sums stored bytes across files and recordings', () => {
    expect(
      attachmentBytes([attachment(), attachment({ id: 'att-2', kind: 'recording', size: 42 })]),
    ).toBe(47);
    expect(
      nodeAttachmentBytes([
        { attachments: [attachment()] },
        {},
        { attachments: [attachment({ id: 'att-3', size: 20 })] },
      ]),
    ).toBe(25);
  });
});

describe('attachment normalisation', () => {
  it('keeps valid entries, recomputes sizes and drops entries without bytes', () => {
    const normalised = normaliseAttachments([
      { ...attachment({ size: 999 }), id: 'att-a' },
      { id: 'att-b', name: 'missing.txt', size: 10 },
      'nonsense',
      null,
      { ...attachment(), id: 'att-a' },
    ]);
    expect(normalised).toHaveLength(1);
    expect(normalised[0].size).toBe(5);
  });

  it('coerces transcript metadata and caps its length', () => {
    const [normalised] = normaliseAttachments([
      {
        ...attachment({ kind: 'recording', name: 'voice.webm', mime: 'audio/webm' }),
        durationSeconds: 63.6,
        transcript: {
          text: 'x'.repeat(ATTACHMENT_LIMITS.maxTranscriptChars + 50),
          provider: 'Local speech-to-text',
          model: 'whisper-1',
          at: '2026-02-01T10:00:00.000Z',
        },
      },
    ]);
    expect(normalised.durationSeconds).toBe(64);
    expect(normalised.transcript?.text).toHaveLength(ATTACHMENT_LIMITS.maxTranscriptChars);
    expect(normalised.transcript?.model).toBe('whisper-1');
  });

  it('ignores a record field that is not an array', () => {
    expect(normaliseAttachments(undefined)).toEqual([]);
    expect(normaliseAttachments({ dataUrl: DATA_URL })).toEqual([]);
  });
});

describe('transcription configuration', () => {
  it('is unavailable until an endpoint and model are both configured and AI is enabled', () => {
    expect(createTranscriber(aiSettings())).toBeNull();
    expect(createTranscriber(aiSettings({ transcriptionEndpoint: 'http://127.0.0.1:8080/v1/audio/transcriptions' }))).toBeNull();
    expect(
      createTranscriber(
        aiSettings({
          transcriptionEndpoint: 'http://127.0.0.1:8080/v1/audio/transcriptions',
          transcriptionModel: 'whisper-1',
        }),
      ),
    ).toBeNull();
    expect(
      createTranscriber(
        aiSettings({
          enabled: true,
          transcriptionEndpoint: 'not a url',
          transcriptionModel: 'whisper-1',
        }),
      ),
    ).toBeNull();
    const transcriber = createTranscriber(
      aiSettings({
        enabled: true,
        transcriptionEndpoint: 'http://127.0.0.1:8080/v1/audio/transcriptions',
        transcriptionModel: 'whisper-1',
      }),
    );
    expect(transcriber?.endpoint).toBe('http://127.0.0.1:8080/v1/audio/transcriptions');
    expect(transcriber?.model).toBe('whisper-1');
  });

  it('explains why transcription is unavailable', () => {
    expect(transcriptionStatus(aiSettings()).reason).toMatch(/optional AI adapter is disabled/);
    expect(
      transcriptionStatus(aiSettings({ enabled: true })).reason,
    ).toMatch(/No speech-to-text service is configured/);
    expect(
      transcriptionStatus(
        aiSettings({
          enabled: true,
          transcriptionEndpoint: 'http://127.0.0.1:8080/v1/audio/transcriptions',
          transcriptionModel: 'whisper-1',
        }),
      ),
    ).toEqual({
      available: true,
      reason: 'Audio will be sent only to http://127.0.0.1:8080/v1/audio/transcriptions.',
    });
  });
});

describe('store attachments', () => {
  it('stores files with a record, exposes their names to search, and refuses transcripts on plain files', () => {
    const store = new NodeStore(new MemoryStorageAdapter());
    const recordId = store.createKnowledge({
      title: 'Bank stabilisation trial with a bundled CSV',
      body: 'A short note that references the attached field sheet for the trial.',
      kind: 'note',
      tags: ['trial'],
      scope: 'private',
      links: [],
      sources: [],
      attachments: [
        attachment({ id: 'att-csv', name: 'trial-readings.csv', mime: 'text/csv', size: 5 }),
      ],
    });

    const record = store.getSnapshot().data.knowledge.find((entry) => entry.id === recordId);
    expect(record?.attachments).toHaveLength(1);
    expect(record?.attachments?.[0].name).toBe('trial-readings.csv');
    expect(record?.attachments?.[0].size).toBe(5);

    const snapshot = store.getSnapshot();
    const found = searchKnowledge(snapshot.data, snapshot.settings.actorId, 'trial-readings.csv');
    expect(found.map((entry) => entry.id)).toContain(recordId);

    expect(() =>
      store.setAttachmentTranscript(recordId, 'att-csv', {
        text: 'not a recording',
        provider: 'test',
        model: 'test',
      }),
    ).toThrow(/recording/);
  });

  it('refuses a record over the attachment budget', () => {
    const store = new NodeStore(new MemoryStorageAdapter());
    expect(() =>
      store.createKnowledge({
        title: 'Too many files on one record',
        body: 'This record should be rejected before it is written to storage.',
        kind: 'note',
        tags: [],
        scope: 'private',
        links: [],
        sources: [],
        attachments: Array.from({ length: ATTACHMENT_LIMITS.maxPerRecord + 1 }, (_, index) =>
          attachment({ id: `att-${index}` }),
        ),
      }),
    ).toThrow(/can hold/);
    expect(store.getSnapshot().data.knowledge).not.toContainEqual(
      expect.objectContaining({ title: 'Too many files on one record' }),
    );
  });

  it('stops the whole node from filling browser storage', () => {
    const store = new NodeStore(new MemoryStorageAdapter());
    const megabyte = 1_200_000;
    const payload = 'A'.repeat(Math.ceil((megabyte * 4) / 3));
    const big = (id: string): KnowledgeAttachment =>
      attachment({
        id,
        name: `${id}.bin`,
        mime: 'application/octet-stream',
        size: megabyte,
        dataUrl: `data:application/octet-stream;base64,${payload}`,
      });
    const base = {
      body: 'A record that exists mostly to carry a large attachment for the budget check.',
      kind: 'note' as const,
      tags: [],
      scope: 'private' as const,
      links: [],
      sources: [],
    };
    store.createKnowledge({ ...base, title: 'Large file one', attachments: [big('one')] });
    store.createKnowledge({ ...base, title: 'Large file two', attachments: [big('two')] });
    expect(() =>
      store.createKnowledge({ ...base, title: 'Large file three', attachments: [big('three')] }),
    ).toThrow(/browser storage/);
    expect(store.getSnapshot().data.knowledge.some((record) => record.title === 'Large file three')).toBe(false);
  });

  it('round-trips attachment bytes through a JSON backup', () => {
    const store = new NodeStore(new MemoryStorageAdapter());
    const recordId = store.createKnowledge({
      title: 'Backup round-trip for an attachment',
      body: 'The file bytes must survive export and import unchanged.',
      kind: 'note',
      tags: [],
      scope: 'private',
      links: [],
      sources: [],
      attachments: [attachment({ id: 'att-backup' })],
    });
    const backup = store.exportBackup();
    const restored = new NodeStore(new MemoryStorageAdapter());
    restored.importBackup(backup);
    const record = restored.getSnapshot().data.knowledge.find((entry) => entry.id === recordId);
    expect(record?.attachments).toHaveLength(1);
    expect(record?.attachments?.[0].dataUrl).toBe(DATA_URL);
    expect(record?.attachments?.[0].size).toBe(5);
  });

  it('ships the sample data with a real CSV attachment', () => {
    const data = createSampleData();
    const record = data.knowledge.find((entry) => entry.id === 'k-waterlog');
    expect(record?.attachments).toHaveLength(1);
    expect(record?.attachments?.[0].mime).toBe('text/csv');
    expect(record?.attachments?.[0].dataUrl.startsWith('data:text/csv;base64,')).toBe(true);
    expect(dataUrlBytes(record!.attachments![0].dataUrl)).toBe(record!.attachments![0].size);
  });
});
