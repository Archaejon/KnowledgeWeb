import { describe, expect, it } from 'vitest';
import {
  accessFor,
  canRead,
  canReadObservation,
  coordsLabel,
  knowledgeSharedBy,
  visibleKnowledge,
  visibleObservations,
} from '../src/core/access';
import { activeGroupAgreementFor, activeRelationshipFor } from '../src/core/consent';
import { createSampleData } from '../src/core/sample';
import type { NodeData } from '../src/core/types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function addRelationshipKnowledge(data: NodeData, authorId: string, title = 'Relationship notes') {
  data.knowledge.push({
    id: 'k-test-rel',
    title,
    body: 'Only available through a current bilateral relationship.',
    authorId,
    kind: 'note',
    tags: ['test'],
    scope: 'relationship',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [],
    links: [],
    sources: [],
  });
}

describe('bilateral relationship access', () => {
  it('gives an active relationship full access to all relationship-scoped records', () => {
    const data = createSampleData();
    addRelationshipKnowledge(data, 'p-idris');
    const visibleRelationship = visibleKnowledge(data, 'p-mara').filter(
      (k) => k.authorId === 'p-idris' && k.scope === 'relationship',
    );
    expect(visibleRelationship.map((k) => k.id)).toEqual(
      expect.arrayContaining(['k-grafting', 'k-swale', 'k-test-rel']),
    );
    const allIdrisRelationship = data.knowledge.filter(
      (k) => k.authorId === 'p-idris' && k.scope === 'relationship',
    );
    expect(allIdrisRelationship.every((k) => canRead(data, 'p-mara', k))).toBe(true);
    // Idris's community-scoped water log is visible because of the Willowbank
    // group agreement, not because of the bilateral relationship.
    expect(
      accessFor(data, 'p-mara', data.knowledge.find((k) => k.id === 'k-waterlog')!).channel,
    ).toBe('community-agreement');
  });

  it('grants nothing through a pending invitation', () => {
    const data = createSampleData();
    addRelationshipKnowledge(data, 'p-tomas');
    expect(activeRelationshipFor(data, 'p-mara', 'p-tomas')).toBeUndefined();
    expect(canRead(data, 'p-mara', data.knowledge.find((k) => k.id === 'k-test-rel')!)).toBe(false);
    const decision = accessFor(data, 'p-mara', {
      id: 'x',
      authorId: 'p-tomas',
      scope: 'relationship',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.channel).toBe('not-shared');
  });

  it('blocks a revoked relationship from future access', () => {
    const data = createSampleData();
    addRelationshipKnowledge(data, 'p-ilse');
    expect(activeRelationshipFor(data, 'p-mara', 'p-ilse')).toBeUndefined();
    expect(canRead(data, 'p-mara', data.knowledge.find((k) => k.id === 'k-test-rel')!)).toBe(false);
    // The author can still read their own record.
    expect(canRead(data, 'p-ilse', data.knowledge.find((k) => k.id === 'k-test-rel')!)).toBe(true);
  });

  it('does not expose private knowledge through any relationship', () => {
    const data = createSampleData();
    const boundary = data.knowledge.find((k) => k.id === 'k-boundary')!;
    expect(canRead(data, 'p-mara', boundary)).toBe(true);
    expect(canRead(data, 'p-idris', boundary)).toBe(false);
    expect(canRead(data, 'p-nia', boundary)).toBe(false);
  });

  it('makes relationship access symmetric and all-or-nothing', () => {
    const data = createSampleData();
    const niaRecord = data.knowledge.find((k) => k.id === 'k-seed')!;
    expect(canRead(data, 'p-mara', niaRecord)).toBe(true);
    // Owen has his own active relationship with Nia, so the same shared record is
    // readable by Owen too. Sam has no relationship with Nia and cannot read it.
    expect(canRead(data, 'p-owen', niaRecord)).toBe(true);
    expect(canRead(data, 'p-sam', niaRecord)).toBe(false);
    expect(knowledgeSharedBy(data, 'p-mara', 'p-nia').map((r) => r.id)).toEqual(['k-seed']);
  });
});

describe('community-scoped access', () => {
  it('allows an active unanimous group agreement', () => {
    const data = createSampleData();
    expect(activeGroupAgreementFor(data, 'c-willowbank', 'p-mara')).toBeDefined();
    const waterLog = data.knowledge.find((k) => k.id === 'k-waterlog')!;
    expect(accessFor(data, 'p-mara', waterLog).allowed).toBe(true);
    expect(accessFor(data, 'p-mara', waterLog).channel).toBe('community-agreement');
    // Not a member of Willowbank.
    expect(canRead(data, 'p-sam', waterLog)).toBe(false);
  });

  it('keeps group knowledge inactive when one participant declined', () => {
    const data = createSampleData();
    const erosion = data.knowledge.find((k) => k.id === 'k-erosion')!;
    expect(activeGroupAgreementFor(data, 'c-bramble', 'p-mara')).toBeUndefined();
    expect(canRead(data, 'p-mara', erosion)).toBe(false);
    expect(canRead(data, 'p-priya', erosion)).toBe(false);
    expect(canRead(data, 'p-ilse', erosion)).toBe(true);
  });

  it('does not let membership alone unlock community-scoped knowledge', () => {
    const data = createSampleData();
    data.communities
      .find((c) => c.id === 'c-willowbank')!
      .members.push({
        personId: 'p-tomas',
        role: 'member',
        status: 'active',
        joinedAt: new Date().toISOString(),
      });
    const waterLog = data.knowledge.find((k) => k.id === 'k-waterlog')!;
    expect(canRead(data, 'p-tomas', waterLog)).toBe(false);
  });

  it('respects public and private scopes independently', () => {
    const data = createSampleData();
    const publicScythe = data.knowledge.find((k) => k.id === 'k-scythe')!;
    expect(canRead(data, 'p-sam', publicScythe)).toBe(true);
    const boundary = data.knowledge.find((k) => k.id === 'k-boundary')!;
    expect(canRead(data, 'p-sam', boundary)).toBe(false);
  });
});

describe('observation and place access', () => {
  it('filters observations through the same scope engine', () => {
    const data = createSampleData();
    const maraObservations = visibleObservations(data, 'p-mara');
    expect(maraObservations.some((o) => o.id === 'o-12')).toBe(false); // Ilse private
    expect(maraObservations.some((o) => o.id === 'o-11')).toBe(false); // Bramble group inactive
    // Hollowcombe agreement is active, so the pond survey is visible to Mara.
    expect(maraObservations.some((o) => o.id === 'o-8')).toBe(true);
    expect(maraObservations.some((o) => o.id === 'o-9')).toBe(true);
    expect(canReadObservation(data, 'p-sam', data.observations.find((o) => o.id === 'o-12')!)).toBe(
      false,
    );
  });

  it('withholds sensitive coordinates from unauthorised viewers', () => {
    const data = createSampleData();
    const orchidBank = data.places.find((p) => p.id === 'pl-orchid-bank')!;
    expect(coordsLabel(data, 'p-mara', orchidBank)).toBe('Location withheld');
    expect(coordsLabel(data, 'p-ilse', orchidBank)).not.toBe('Location withheld');
    const willowbank = data.places.find((p) => p.id === 'pl-wb14')!;
    expect(coordsLabel(data, 'p-mara', willowbank)).toContain('51.0912');
    expect(coordsLabel(data, 'p-sam', willowbank)).toBe('Location withheld');
  });

  it('does not expose a private observation to a connected partner', () => {
    const data = clone(createSampleData());
    data.observations.find((o) => o.id === 'o-12')!.observerId = 'p-idris';
    data.observations.find((o) => o.id === 'o-12')!.scope = 'private';
    expect(canReadObservation(data, 'p-mara', data.observations.find((o) => o.id === 'o-12')!)).toBe(
      false,
    );
  });
});
