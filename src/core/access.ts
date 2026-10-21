/**
 * Access control engine.
 *
 * This is the single place that decides whether an acting identity may read a
 * record. Every list, search result, export, chart and AI retrieval goes
 * through it. In this browser prototype it runs inside the local node service;
 * in a hosted or peer node the same module would run server-side. Simulated
 * identities and the lack of transport security are documented limitations.
 */
import {
  activeGroupAgreementFor,
  activeRelationshipFor,
  isActiveMember,
  membershipFor,
} from './consent';
import type {
  ActorId,
  Community,
  Gathering,
  KnowledgeRecord,
  NodeData,
  Observation,
  Place,
  Project,
  Scope,
  Shareable,
} from './types';

export type AccessChannel =
  | 'author'
  | 'relationship'
  | 'community-agreement'
  | 'public'
  | 'not-shared';

export interface AccessDecision {
  allowed: boolean;
  channel: AccessChannel;
  explanation: string;
}

const DENIED: AccessDecision = {
  allowed: false,
  channel: 'not-shared',
  explanation: 'This record is not shared with you.',
};

export function personName(db: NodeData, id: ActorId | undefined): string {
  if (!id) return 'Unknown participant';
  return db.people.find((p) => p.id === id)?.name ?? 'Unknown participant';
}

/**
 * Binary relationship access: if (and only if) an active bilateral relationship
 * exists, ALL of the owner's relationship-scoped knowledge is readable. There is
 * no per-record override and no partial relationship.
 */
export function relationshipAllows(
  db: NodeData,
  viewerId: ActorId,
  ownerId: ActorId,
): boolean {
  if (viewerId === ownerId) return true;
  return Boolean(activeRelationshipFor(db, viewerId, ownerId));
}

/** Community-shared records require membership AND an active unanimous agreement. */
export function communityAllows(
  db: NodeData,
  viewerId: ActorId,
  communityId: string | undefined,
): boolean {
  if (!communityId) return false;
  if (!isActiveMember(db, communityId, viewerId)) return false;
  return Boolean(activeGroupAgreementFor(db, communityId, viewerId));
}

export interface AccessSubject {
  ownerId: ActorId;
  scope: Scope;
  communityId?: string;
}

export function accessFor(
  db: NodeData,
  viewerId: ActorId,
  record: Shareable,
): AccessDecision {
  return accessForSubject(db, viewerId, {
    ownerId: record.authorId,
    scope: record.scope,
    communityId: record.communityId,
  });
}

export function accessForSubject(
  db: NodeData,
  viewerId: ActorId,
  record: AccessSubject,
): AccessDecision {
  if (record.ownerId === viewerId) {
    return {
      allowed: true,
      channel: 'author',
      explanation: 'You created this record.',
    };
  }

  switch (record.scope as Scope) {
    case 'private':
      return DENIED;
    case 'public':
      return {
        allowed: true,
        channel: 'public',
        explanation: 'The author made this record public.',
      };
    case 'relationship':
      return relationshipAllows(db, viewerId, record.ownerId)
        ? {
            allowed: true,
            channel: 'relationship',
            explanation: `Shared through an active relationship with ${personName(db, record.ownerId)}.`,
          }
        : DENIED;
    case 'community': {
      if (!communityAllows(db, viewerId, record.communityId)) {
        return {
          allowed: false,
          channel: 'not-shared',
          explanation:
            'Community-shared knowledge needs active membership and a group agreement that includes you.',
        };
      }
      return {
        allowed: true,
        channel: 'community-agreement',
        explanation: `Shared with participants of an active group agreement in ${
          db.communities.find((c) => c.id === record.communityId)?.name ?? 'this community'
        }.`,
      };
    }
    default:
      return DENIED;
  }
}

export function canRead(db: NodeData, viewerId: ActorId, record: Shareable): boolean {
  return accessFor(db, viewerId, record).allowed;
}

export function visibleKnowledge(
  db: NodeData,
  viewerId: ActorId,
  records: readonly KnowledgeRecord[] = db.knowledge,
): KnowledgeRecord[] {
  return records.filter((r) => canRead(db, viewerId, r));
}

export function canReadObservation(
  db: NodeData,
  viewerId: ActorId,
  observation: Observation,
): boolean {
  return accessForSubject(db, viewerId, {
    ownerId: observation.observerId,
    scope: observation.scope,
    communityId: observation.communityId,
  }).allowed;
}

export function visibleObservations(
  db: NodeData,
  viewerId: ActorId,
  observations: readonly Observation[] = db.observations,
): Observation[] {
  return observations.filter((o) => canReadObservation(db, viewerId, o));
}

/** Community membership is required to see the space itself. */
export function canViewCommunity(db: NodeData, viewerId: ActorId, community: Community): boolean {
  return isActiveMember(db, community.id, viewerId);
}

/** Membership directory is opt-in per person and only visible to active members. */
export function canViewDirectory(db: NodeData, viewerId: ActorId, community: Community): boolean {
  return isActiveMember(db, community.id, viewerId);
}

export function canViewGathering(db: NodeData, viewerId: ActorId, gathering: Gathering): boolean {
  return (
    gathering.organiserId === viewerId || isActiveMember(db, gathering.communityId, viewerId)
  );
}

export function canViewProject(db: NodeData, viewerId: ActorId, project: Project): boolean {
  return (
    project.leadId === viewerId ||
    project.participants.includes(viewerId) ||
    isActiveMember(db, project.communityId, viewerId)
  );
}

export function canManageCommunity(db: NodeData, viewerId: ActorId, communityId: string): boolean {
  const membership = membershipFor(db, communityId, viewerId);
  return membership?.status === 'active' && membership.role === 'steward';
}

export function canViewPlace(
  db: NodeData,
  viewerId: ActorId,
  place: Place,
): boolean {
  if (place.coordinatePolicy === 'open') return true;
  if (!place.communityId) return false;
  return isActiveMember(db, place.communityId, viewerId);
}

/**
 * Nodal locations are physical places for in-person exchange. Their directory
 * card has its own visibility choice: public to the node, active members of
 * the linked community, or the owner only. This is separate from coordinate
 * precision and from knowledge-sharing scope.
 */
export function canViewNodalLocation(
  db: NodeData,
  viewerId: ActorId,
  place: Place,
): boolean {
  if (!place.nodal) return false;
  if (place.ownerId === viewerId) return true;
  if (place.nodal.visibility === 'public') return true;
  if (place.nodal.visibility === 'community') {
    return Boolean(place.communityId) && isActiveMember(db, place.communityId!, viewerId);
  }
  return false;
}

/**
 * Precise coordinates have their own privacy switch, independent of the
 * observation's sharing scope. Sensitive places stay blurred for others.
 */
export function canViewCoordinates(
  db: NodeData,
  viewerId: ActorId,
  place: Place,
): boolean {
  if (place.coordinatePolicy === 'open') return true;
  if (place.ownerId === viewerId) return true;
  if (place.coordinatePolicy === 'owner-only') {
    return Boolean(
      db.observations.some((o) => o.placeId === place.id && o.observerId === viewerId),
    );
  }
  return Boolean(place.communityId) && isActiveMember(db, place.communityId!, viewerId);
}

export function coordsLabel(db: NodeData, viewerId: ActorId, place: Place): string {
  if (!canViewCoordinates(db, viewerId, place)) return 'Location withheld';
  if (place.lat === undefined || place.lng === undefined) return 'No coordinates recorded';
  return `${place.lat.toFixed(4)}°, ${place.lng.toFixed(4)}°`;
}

/** Visible members only, honouring per-person directory opt-in. */
export function visibleDirectory(db: NodeData, viewerId: ActorId, community: Community) {
  if (!canViewDirectory(db, viewerId, community)) return [];
  return community.members
    .filter((m) => m.status === 'active')
    .map((m) => ({ membership: m, person: db.people.find((p) => p.id === m.personId) }))
    .filter((entry) => entry.person && (entry.person.directoryOptIn || entry.person.id === viewerId));
}

/** People the viewer may address or see in network/invitation contexts. */
export function knownPeople(db: NodeData, viewerId: ActorId) {
  const ids = new Set<string>([viewerId]);
  for (const rel of db.relationships) {
    if (rel.aId === viewerId) ids.add(rel.bId);
    if (rel.bId === viewerId) ids.add(rel.aId);
  }
  for (const community of db.communities) {
    if (isActiveMember(db, community.id, viewerId)) {
      for (const member of community.members) {
        if (member.status === 'active') ids.add(member.personId);
      }
    }
  }
  return db.people.filter((p) => ids.has(p.id));
}

/**
 * Knowledge authored by someone else that the viewer can currently read.
 * Used by the "why can I see this" panels and the consent walkthrough.
 */
export function knowledgeSharedBy(db: NodeData, viewerId: ActorId, ownerId: ActorId) {
  return db.knowledge.filter(
    (record) =>
      record.authorId === ownerId &&
      record.scope === 'relationship' &&
      canRead(db, viewerId, record),
  );
}

export function relationshipScopeTitles(db: NodeData, ownerId: ActorId): string[] {
  return db.knowledge
    .filter((r) => r.authorId === ownerId && r.scope === 'relationship')
    .map((r) => r.title);
}

/**
 * Consent events relevant to the viewer. Community-level events are visible to
 * active members; relationship and agreement events only to those involved.
 */
import type { ConsentEvent } from './types';

export function visibleConsentEvents(db: NodeData, viewerId: ActorId): ConsentEvent[] {
  return db.consentLog
    .filter(
      (event) =>
        event.actorId === viewerId ||
        event.subjectIds?.includes(viewerId) ||
        (event.communityId ? isActiveMember(db, event.communityId, viewerId) : false),
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function scopeLabel(scope: Scope): string {
  switch (scope) {
    case 'private':
      return 'Private';
    case 'relationship':
      return 'Relationship-shared';
    case 'community':
      return 'Group-shared';
    case 'public':
      return 'Public';
  }
}

export function scopeDescription(scope: Scope, communityName?: string): string {
  switch (scope) {
    case 'private':
      return 'Only you can read this. It never leaves your node through a relationship.';
    case 'relationship':
      return 'Every active bilateral partner can read all of these records. Not pending or declined connections.';
    case 'community':
      return communityName
        ? `Every participant of an active group agreement in ${communityName}. Membership alone does not grant access.`
        : 'Every participant of an active group agreement in the selected community.';
    case 'public':
      return 'Anyone using this node can read this and cite it. Do not put sensitive details here.';
  }
}
