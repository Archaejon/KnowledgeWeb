import type {
  GroupAgreement,
  InterCommunityAgreement,
  Membership,
  NodeData,
  PersonRelationship,
  RelationshipStatus,
} from './types';

export type GroupAgreementStatus = 'proposed' | 'active' | 'declined' | 'withdrawn';
export type InterAgreementStatus = 'proposed' | 'active' | 'declined' | 'withdrawn';

/**
 * The current pair record for two people, whichever direction it was created
 * in. When a relationship was revoked or declined and later re-proposed, the
 * most recent record is the effective one; earlier records remain as history.
 */
export function relationshipFor(
  db: NodeData,
  aId: string,
  bId: string,
): PersonRelationship | undefined {
  return db.relationships
    .filter((r) => (r.aId === aId && r.bId === bId) || (r.aId === bId && r.bId === aId))
    .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt))[0];
}

export function activeRelationshipFor(
  db: NodeData,
  aId: string,
  bId: string,
): PersonRelationship | undefined {
  const rel = relationshipFor(db, aId, bId);
  return rel?.status === 'active' ? rel : undefined;
}

const ALLOWED_RELATIONSHIP_TRANSITIONS: Record<RelationshipStatus, RelationshipStatus[]> = {
  pending: ['active', 'declined', 'revoked'],
  active: ['revoked'],
  declined: ['pending'],
  revoked: ['pending'],
};

/** A relationship can only become active by explicit acceptance. */
export function canTransitionRelationship(
  from: RelationshipStatus,
  to: RelationshipStatus,
): boolean {
  return ALLOWED_RELATIONSHIP_TRANSITIONS[from].includes(to);
}

/**
 * A group agreement requires every named participant to accept. It is active
 * only when all responses are accepted; a single decline closes it. Status is
 * derived from responses so it can never drift out of sync with consent.
 */
export function groupAgreementStatus(agreement: GroupAgreement): GroupAgreementStatus {
  if (agreement.withdrawnAt) return 'withdrawn';
  if (agreement.responses.length === 0) return 'proposed';
  if (agreement.responses.some((r) => r.state === 'declined')) return 'declined';
  if (agreement.responses.every((r) => r.state === 'accepted')) return 'active';
  return 'proposed';
}

export function groupAgreementCounts(agreement: GroupAgreement) {
  return {
    required: agreement.responses.length,
    accepted: agreement.responses.filter((r) => r.state === 'accepted').length,
    declined: agreement.responses.filter((r) => r.state === 'declined').length,
    pending: agreement.responses.filter((r) => r.state === 'pending').length,
  };
}

export function activeGroupAgreementFor(
  db: NodeData,
  communityId: string,
  personId: string,
): GroupAgreement | undefined {
  return db.groupAgreements.find(
    (g) =>
      g.communityId === communityId &&
      groupAgreementStatus(g) === 'active' &&
      g.responses.some((r) => r.personId === personId && r.state === 'accepted'),
  );
}

export function agreesToGroupSharing(db: NodeData, communityId: string, personId: string): boolean {
  return Boolean(activeGroupAgreementFor(db, communityId, personId));
}

export function interAgreementStatus(agreement: InterCommunityAgreement): InterAgreementStatus {
  if (agreement.withdrawnAt) return 'withdrawn';
  if (agreement.parties.some((p) => p.state === 'declined')) return 'declined';
  if (agreement.parties.length > 0 && agreement.parties.every((p) => p.state === 'accepted')) {
    return 'active';
  }
  return 'proposed';
}

export function membershipFor(
  db: NodeData,
  communityId: string,
  personId: string,
): Membership | undefined {
  return db.communities
    .find((c) => c.id === communityId)
    ?.members.find((m) => m.personId === personId);
}

export function isActiveMember(db: NodeData, communityId: string, personId: string): boolean {
  return membershipFor(db, communityId, personId)?.status === 'active';
}

export function pendingRelationshipInvitations(db: NodeData, personId: string) {
  return db.relationships.filter(
    (r) => r.status === 'pending' && (r.aId === personId || r.bId === personId),
  );
}
