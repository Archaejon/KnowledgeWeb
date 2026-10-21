import { describe, expect, it } from 'vitest';
import {
  canTransitionRelationship,
  groupAgreementCounts,
  groupAgreementStatus,
  interAgreementStatus,
  relationshipFor,
} from '../src/core/consent';
import { createSampleData } from '../src/core/sample';
import type { GroupAgreement, InterCommunityAgreement } from '../src/core/types';

function agreement(overrides: Partial<GroupAgreement> = {}): GroupAgreement {
  return {
    id: 'ga-test',
    communityId: 'c-willowbank',
    title: 'Test',
    description: 'Test agreement',
    proposedBy: 'p-mara',
    createdAt: new Date().toISOString(),
    responses: [
      { personId: 'p-mara', state: 'accepted' },
      { personId: 'p-idris', state: 'accepted' },
    ],
    ...overrides,
  };
}

describe('group agreements', () => {
  it('is active only when every response is accepted', () => {
    expect(groupAgreementStatus(agreement())).toBe('active');
    expect(
      groupAgreementStatus(
        agreement({ responses: [{ personId: 'p-mara', state: 'accepted' }, { personId: 'p-idris', state: 'pending' }] }),
      ),
    ).toBe('proposed');
    expect(
      groupAgreementStatus(
        agreement({ responses: [{ personId: 'p-mara', state: 'accepted' }, { personId: 'p-idris', state: 'declined' }] }),
      ),
    ).toBe('declined');
    expect(groupAgreementStatus(agreement({ withdrawnAt: new Date().toISOString() }))).toBe('withdrawn');
  });

  it('cannot treat an empty agreement as active', () => {
    expect(groupAgreementStatus(agreement({ responses: [] }))).toBe('proposed');
  });

  it('counts responses accurately', () => {
    expect(
      groupAgreementCounts(
        agreement({
          responses: [
            { personId: 'p-mara', state: 'accepted' },
            { personId: 'p-idris', state: 'pending' },
            { personId: 'p-nia', state: 'declined' },
          ],
        }),
      ),
    ).toEqual({ required: 3, accepted: 1, declined: 1, pending: 1 });
  });

  it('derives the sample agreement states correctly', () => {
    const data = createSampleData();
    expect(groupAgreementStatus(data.groupAgreements.find((g) => g.id === 'ga-willowbank')!)).toBe(
      'active',
    );
    expect(groupAgreementStatus(data.groupAgreements.find((g) => g.id === 'ga-bramble')!)).toBe(
      'declined',
    );
    expect(groupAgreementStatus(data.groupAgreements.find((g) => g.id === 'ga-hollowcombe')!)).toBe(
      'active',
    );
  });
});

describe('inter-community agreements', () => {
  function inter(overrides: Partial<InterCommunityAgreement> = {}): InterCommunityAgreement {
    return {
      id: 'ia-test',
      title: 'Test',
      terms: 'Test terms',
      proposedBy: 'p-mara',
      createdAt: new Date().toISOString(),
      parties: [
        { communityId: 'c-willowbank', state: 'accepted' },
        { communityId: 'c-bramble', state: 'pending' },
      ],
      ...overrides,
    };
  }

  it('requires every party to accept', () => {
    expect(interAgreementStatus(inter())).toBe('proposed');
    expect(
      interAgreementStatus(
        inter({
          parties: [
            { communityId: 'c-willowbank', state: 'accepted' },
            { communityId: 'c-bramble', state: 'accepted' },
          ],
        }),
      ),
    ).toBe('active');
    expect(
      interAgreementStatus(
        inter({
          parties: [
            { communityId: 'c-willowbank', state: 'accepted' },
            { communityId: 'c-bramble', state: 'declined' },
          ],
        }),
      ),
    ).toBe('declined');
  });
});

describe('relationship transitions', () => {
  it('permits only explicit consent transitions', () => {
    expect(canTransitionRelationship('pending', 'active')).toBe(true);
    expect(canTransitionRelationship('pending', 'declined')).toBe(true);
    expect(canTransitionRelationship('active', 'revoked')).toBe(true);
    expect(canTransitionRelationship('active', 'declined')).toBe(false);
    expect(canTransitionRelationship('declined', 'active')).toBe(false);
    expect(canTransitionRelationship('revoked', 'active')).toBe(false);
  });

  it('uses the most recent record for a pair', () => {
    const data = createSampleData();
    data.relationships.push({
      id: 'rel-new',
      aId: 'p-mara',
      bId: 'p-ilse',
      initiatedBy: 'p-mara',
      status: 'pending',
      proposedAt: new Date(Date.now() + 1000).toISOString(),
      cachedCopiesHeld: false,
    });
    expect(relationshipFor(data, 'p-mara', 'p-ilse')?.id).toBe('rel-new');
  });
});
