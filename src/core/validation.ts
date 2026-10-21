import { ATTACHMENT_LIMITS } from './attachments';
import { SCHEMA_VERSION } from './types';
import type { NodeData, PersistedState, Scope, ThemeId } from './types';

const SCOPES: Scope[] = ['private', 'relationship', 'community', 'public'];
const THEMES: ThemeId[] = ['web', 'tree', 'mycelium'];
const NODAL_KINDS = [
  'gathering-spot',
  'community-centre',
  'commune',
  'workshop',
  'learning-space',
  'other',
];
const NODAL_VISIBILITIES = ['public', 'community', 'private'];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const MAX_ERRORS = 8;

/**
 * Runtime validation for imported backups and persisted state. This is not a
 * complete schema validator, but it rejects malformed files before they can
 * replace a working node and reports the first few problems in plain language.
 */
export function validatePersistedState(value: unknown): ValidationResult {
  const errors: string[] = [];
  const fail = (message: string) => {
    if (errors.length < MAX_ERRORS) errors.push(message);
  };

  if (!value || typeof value !== 'object') {
    return { ok: false, errors: ['The backup is not a JSON object.'] };
  }
  const state = value as Partial<PersistedState>;
  if (state.schemaVersion !== SCHEMA_VERSION) {
    fail(`Unsupported schema version ${String(state.schemaVersion)} (expected ${SCHEMA_VERSION}).`);
  }
  const data = state.data as Partial<NodeData> | undefined;
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['The backup has no node data.'] };
  }

  const arrays: (keyof NodeData)[] = [
    'people',
    'communities',
    'relationships',
    'groupAgreements',
    'interCommunityAgreements',
    'knowledge',
    'observations',
    'places',
    'projects',
    'gatherings',
    'consentLog',
  ];
  for (const key of arrays) {
    if (!Array.isArray((data as Record<string, unknown>)[key])) {
      fail(`Missing or invalid “${key}” collection.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const people = data.people as NodeData['people'];
  const peopleIds = new Set(people.map((p) => p.id).filter(Boolean));
  if (peopleIds.size === 0) fail('The backup contains no participants.');

  const communities = data.communities as NodeData['communities'];
  const communityIds = new Set(communities.map((c) => c.id));
  for (const person of people) {
    if (!person.id || !person.name || !person.handle) fail('A participant is missing id, name or handle.');
    if (person.directoryOptIn === undefined) fail(`Participant ${person.name ?? '?'} lacks directory consent.`);
  }
  for (const community of communities) {
    if (!community.id || !community.name) fail('A community is missing id or name.');
    if (!Array.isArray(community.members)) fail(`Community ${community.name ?? '?'} has no member list.`);
    for (const member of community.members ?? []) {
      if (!peopleIds.has(member.personId)) fail(`Community ${community.name} refers to an unknown person.`);
    }
  }
  for (const rel of data.relationships as NodeData['relationships']) {
    if (!peopleIds.has(rel.aId) || !peopleIds.has(rel.bId)) fail('A relationship refers to an unknown person.');
    if (!['pending', 'active', 'declined', 'revoked'].includes(rel.status)) {
      fail(`Relationship ${rel.id} has an invalid status.`);
    }
  }
  for (const agreement of data.groupAgreements as NodeData['groupAgreements']) {
    if (!communityIds.has(agreement.communityId)) fail('A group agreement refers to an unknown community.');
    for (const response of agreement.responses) {
      if (!peopleIds.has(response.personId)) fail('A group agreement response refers to an unknown person.');
    }
  }
  for (const record of data.knowledge as NodeData['knowledge']) {
    if (!peopleIds.has(record.authorId)) fail(`Knowledge record “${record.title}” has an unknown author.`);
    if (!SCOPES.includes(record.scope)) fail(`Knowledge record “${record.title}” has an invalid scope.`);
    if (typeof record.title !== 'string' || typeof record.body !== 'string') {
      fail('A knowledge record is missing its title or body.');
    }
    if (record.attachments !== undefined) {
      if (!Array.isArray(record.attachments)) {
        fail(`Knowledge record “${record.title}” has malformed attachments.`);
      }
      if (record.attachments.length > ATTACHMENT_LIMITS.maxPerRecord) {
        fail(`Knowledge record “${record.title}” has more attachments than this node allows.`);
      }
      for (const attachment of record.attachments) {
        if (typeof attachment?.dataUrl !== 'string' || !attachment.dataUrl.startsWith('data:')) {
          fail(`An attachment on “${record.title}” is missing its file bytes.`);
        }
        if (typeof attachment?.name !== 'string' || !attachment.name.trim()) {
          fail(`An attachment on “${record.title}” has no file name.`);
        }
      }
    }
  }
  for (const observation of data.observations as NodeData['observations']) {
    if (!peopleIds.has(observation.observerId)) fail('An observation has an unknown observer.');
    if (!SCOPES.includes(observation.scope)) fail('An observation has an invalid scope.');
  }
  for (const place of data.places as NodeData['places']) {
    if (!peopleIds.has(place.ownerId)) fail(`Place “${place.name}” has an unknown owner.`);
    if (!['open', 'community', 'owner-only'].includes(place.coordinatePolicy)) {
      fail(`Place “${place.name}” has an invalid coordinate policy.`);
    }
    if (place.communityId && !communityIds.has(place.communityId)) {
      fail(`Place “${place.name}” refers to an unknown community.`);
    }
    if (place.nodal) {
      if (!NODAL_KINDS.includes(place.nodal.kind)) {
        fail(`Nodal location “${place.name}” has an unknown kind.`);
      }
      if (!NODAL_VISIBILITIES.includes(place.nodal.visibility)) {
        fail(`Nodal location “${place.name}” has an invalid visibility.`);
      }
      if (place.nodal.visibility === 'community' && !place.communityId) {
        fail(`Nodal location “${place.name}” needs a community for community visibility.`);
      }
      if (place.nodal.contactId && !peopleIds.has(place.nodal.contactId)) {
        fail(`Nodal location “${place.name}” has an unknown contact.`);
      }
      if (typeof place.nodal.description !== 'string') {
        fail(`Nodal location “${place.name}” is missing its description.`);
      }
    }
  }
  for (const project of data.projects as NodeData['projects']) {
    if (!communityIds.has(project.communityId)) fail(`Project “${project.title}” has an unknown community.`);
  }
  for (const gathering of data.gatherings as NodeData['gatherings']) {
    if (!communityIds.has(gathering.communityId)) {
      fail(`Gathering “${gathering.title}” has an unknown community.`);
    }
    if (gathering.nodalLocationId) {
      const venue = (data.places as NodeData['places']).find(
        (place) => place.id === gathering.nodalLocationId,
      );
      if (!venue?.nodal) {
        fail(`Gathering “${gathering.title}” refers to an unknown nodal location.`);
      }
    }
  }

  const settings = state.settings;
  if (!settings || !THEMES.includes(settings.theme)) {
    fail('The theme setting is missing or invalid.');
  } else if (!peopleIds.has(settings.actorId)) {
    fail('The acting identity does not exist in this backup.');
  }

  return { ok: errors.length === 0, errors };
}

export function requireText(value: string, label: string, min = 2, max = 5000): string {
  const trimmed = value.trim();
  if (trimmed.length < min) throw new Error(`${label} needs at least ${min} characters.`);
  if (trimmed.length > max) throw new Error(`${label} must be under ${max} characters.`);
  return trimmed;
}

export function optionalText(value: string | undefined, max = 5000): string {
  return (value ?? '').trim().slice(0, max);
}

/** Tags: lowercase, trimmed, deduplicated, safe length. */
export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0 && tag.length <= 32),
    ),
  ).slice(0, 12);
}

export function isValidDate(value: string): boolean {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

export function isSafeHttpUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
