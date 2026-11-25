/**
 * What crosses a live peer link, and how incoming data is checked.
 *
 * Outgoing: only knowledge the partner may already read under the access engine
 * (the owner's relationship- and public-scoped records). Community records are
 * never sent: a group agreement on this node means nothing on the partner's.
 * Links to local projects, gatherings, places and communities are stripped,
 * because those IDs do not exist on the other node.
 *
 * Incoming: untrusted. Every field is re-validated, every record must be
 * authored by the partner, and the partner's set replaces what was held before,
 * so edits, deletions and scope changes on their side are reflected here.
 */
import { canRead } from '../access';
import { normaliseAttachments } from '../attachments';
import type { KnowledgeKind, KnowledgeLink, KnowledgeRecord, NodeData, Person, Scope } from '../types';
import { isSafeHttpUrl } from '../validation';

export const PROTOCOL = 'understory/v1';
export const MAX_SYNC_RECORDS = 500;

export interface PeerProfile {
  name: string;
  handle: string;
  locality: string;
  bio: string;
}

export type WireMessage =
  | { t: 'request'; profile: PeerProfile }
  | { t: 'confirm' }
  | { t: 'decline' }
  | { t: 'sync'; profile: PeerProfile; records: KnowledgeRecord[] }
  | { t: 'revoke' };

const KINDS: KnowledgeKind[] = [
  'note',
  'observation',
  'research',
  'meeting-note',
  'guide',
  'oral-history',
  'dataset',
  'lesson',
];
const LINK_KINDS: KnowledgeLink['kind'][] = ['website', 'document', 'person', 'dataset', 'other'];
const SHARED_SCOPES: Scope[] = ['relationship', 'public'];

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function line(value: unknown, max: number): string {
  return text(value, max).replace(/[\u0000-\u001f]/g, ' ').trim();
}

function isoOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

export function profileOf(person: Person): PeerProfile {
  return {
    name: person.name,
    handle: person.handle,
    locality: person.locality,
    bio: person.bio,
  };
}

export function cleanProfile(value: unknown): PeerProfile | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = line(raw.name, 80);
  if (name.length < 1) return null;
  const handle = line(raw.handle, 40);
  return {
    name,
    handle: handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '',
    locality: line(raw.locality, 120),
    bio: text(raw.bio, 800),
  };
}

/** Records the owner shares with this partner, with local-only links removed. */
export function outgoingRecords(data: NodeData, ownerId: string, partnerId: string): KnowledgeRecord[] {
  return data.knowledge
    .filter(
      (record) =>
        record.authorId === ownerId &&
        SHARED_SCOPES.includes(record.scope) &&
        canRead(data, partnerId, record),
    )
    .map((record) => ({
      ...record,
      communityId: undefined,
      projectId: undefined,
      gatheringId: undefined,
      placeId: undefined,
      isSample: undefined,
    }));
}

/** Validate one incoming record. Returns null when it must be refused. */
export function cleanIncomingRecord(value: unknown, partnerId: string): KnowledgeRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (raw.authorId !== partnerId) return null;
  if (typeof raw.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.id)) return null;
  if (!SHARED_SCOPES.includes(raw.scope as Scope)) return null;
  const title = line(raw.title, 160);
  const body = text(raw.body, 40000);
  if (title.length < 1 || body.trim().length < 1) return null;
  const now = new Date().toISOString();
  const createdAt = isoOr(raw.createdAt, now);
  const links = Array.isArray(raw.links) ? raw.links : [];
  const versions = Array.isArray(raw.versions) ? raw.versions : [];
  return {
    id: raw.id,
    title,
    body,
    authorId: partnerId,
    kind: KINDS.includes(raw.kind as KnowledgeKind) ? (raw.kind as KnowledgeKind) : 'note',
    tags: (Array.isArray(raw.tags) ? raw.tags : [])
      .map((tag) => line(tag, 40))
      .filter(Boolean)
      .slice(0, 12),
    scope: raw.scope as Scope,
    createdAt,
    updatedAt: isoOr(raw.updatedAt, createdAt),
    versions: versions.slice(-20).flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const v = entry as Record<string, unknown>;
      return [
        {
          at: isoOr(v.at, createdAt),
          byId: partnerId,
          note: line(v.note, 160),
          title: line(v.title, 160),
          body: text(v.body, 40000),
          scope: SHARED_SCOPES.includes(v.scope as Scope) ? (v.scope as Scope) : 'relationship',
        },
      ];
    }),
    links: links.slice(0, 10).flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];
      const l = entry as Record<string, unknown>;
      const label = line(l.label, 120);
      if (!label) return [];
      const url = typeof l.url === 'string' && isSafeHttpUrl(l.url) ? l.url : undefined;
      return [
        {
          label,
          url,
          note: line(l.note, 300) || undefined,
          kind: LINK_KINDS.includes(l.kind as KnowledgeLink['kind'])
            ? (l.kind as KnowledgeLink['kind'])
            : 'other',
        },
      ];
    }),
    sources: (Array.isArray(raw.sources) ? raw.sources : [])
      .map((source) => line(source, 300))
      .filter(Boolean)
      .slice(0, 10),
    attachments: normaliseAttachments(raw.attachments),
  };
}

export function parseWire(value: unknown): WireMessage | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  switch (raw.t) {
    case 'confirm':
    case 'decline':
    case 'revoke':
      return { t: raw.t };
    case 'request': {
      const profile = cleanProfile(raw.profile);
      return profile ? { t: 'request', profile } : null;
    }
    case 'sync': {
      const profile = cleanProfile(raw.profile);
      if (!profile || !Array.isArray(raw.records) || raw.records.length > MAX_SYNC_RECORDS) return null;
      // Records are cleaned against the partner's ID by the store, which knows it.
      return { t: 'sync', profile, records: raw.records as KnowledgeRecord[] };
    }
    default:
      return null;
  }
}

/** Order-independent fingerprint of an outgoing payload, to skip resending identical data. */
export function payloadSignature(profile: PeerProfile, records: KnowledgeRecord[]): string {
  const parts = records
    .map((record) => `${record.id}:${record.updatedAt}:${record.scope}:${record.attachments?.length ?? 0}`)
    .sort();
  return JSON.stringify([profile, parts]);
}
