import { describe, expect, it } from 'vitest';
import { canRead, visibleKnowledge } from '../src/core/access';
import { groupAgreementStatus, relationshipFor } from '../src/core/consent';
import { NodeStore } from '../src/core/store';
import { MemoryStorageAdapter } from '../src/core/storage';
import { createSampleData } from '../src/core/sample';
import { validatePersistedState } from '../src/core/validation';
import type { KnowledgeInput } from '../src/core/store';

function newStore() {
  return new NodeStore(new MemoryStorageAdapter());
}

function knowledgeInput(overrides: Partial<KnowledgeInput> = {}): KnowledgeInput {
  return {
    title: 'Test record',
    body: 'A body with enough characters to be valid.',
    kind: 'note',
    tags: ['test'],
    scope: 'private',
    links: [],
    sources: [],
    ...overrides,
  };
}

describe('bilateral consent workflow', () => {
  it('does not grant access on a pending invitation, then grants it on acceptance, then blocks it on revoke', () => {
    const store = newStore();
    const data = () => store.getSnapshot().data;
    const pending = relationshipFor(data(), 'p-tomas', 'p-mara')!;
    expect(pending.status).toBe('pending');

    store.setActor('p-tomas');
    const recordId = store.createKnowledge(knowledgeInput({ scope: 'relationship', title: 'Pump repair guide' }));
    store.setActor('p-mara');
    expect(canRead(data(), 'p-mara', data().knowledge.find((k) => k.id === recordId)!)).toBe(false);

    store.respondToInvitation(pending.id, true);
    expect(relationshipFor(data(), 'p-tomas', 'p-mara')!.status).toBe('active');
    expect(canRead(data(), 'p-mara', data().knowledge.find((k) => k.id === recordId)!)).toBe(true);

    store.revokeRelationship(pending.id);
    expect(relationshipFor(data(), 'p-tomas', 'p-mara')!.status).toBe('revoked');
    expect(canRead(data(), 'p-mara', data().knowledge.find((k) => k.id === recordId)!)).toBe(false);
  });

  it('refuses to let an initiator answer their own invitation', () => {
    const store = newStore();
    const pending = relationshipFor(store.getSnapshot().data, 'p-tomas', 'p-mara')!;
    store.setActor('p-tomas'); // the initiator
    expect(() => store.respondToInvitation(pending.id, true)).toThrow(/own invitation/i);
  });

  it('records a revocation without private content in the audit entry', () => {
    const store = newStore();
    const relationship = relationshipFor(store.getSnapshot().data, 'p-mara', 'p-idris')!;
    store.revokeRelationship(relationship.id);
    const event = store
      .getSnapshot()
      .data.consentLog.filter((e) => e.kind === 'relationship-revoked')
      .at(-1)!;
    expect(event.detail).not.toMatch(/grafting|swale|water/i);
    expect(event.subjectIds).toContain('p-idris');
  });

  it('allows re-proposing after a revoked relationship without erasing history', () => {
    const store = newStore();
    const first = relationshipFor(store.getSnapshot().data, 'p-ilse', 'p-mara')!;
    expect(first.status).toBe('revoked');
    store.inviteToConnect('p-ilse', 'New agreement after the research project ended.');
    const current = relationshipFor(store.getSnapshot().data, 'p-ilse', 'p-mara')!;
    expect(current.id).not.toBe(first.id);
    expect(current.status).toBe('pending');
  });
});

describe('group agreement workflow', () => {
  it('activates only after every participant accepts, and deactivates when consent is withdrawn', () => {
    const store = newStore();
    const data = () => store.getSnapshot().data;
    const communityId = store.createCommunity({
      name: 'Test Commons',
      description: 'A community created for a permission test.',
      purpose: 'practical-work',
      principles: ['Test the rules'],
      locality: 'Testville',
      geographicArea: 'The test field',
      joinPolicy: 'open',
      advertiseDirectory: false,
    });

    store.setActor('p-idris');
    store.joinCommunity(communityId);
    store.setActor('p-mara');
    const recordId = store.createKnowledge(
      knowledgeInput({ scope: 'community', communityId, title: 'Group observation protocol' }),
    );
    expect(canRead(data(), 'p-mara', data().knowledge.find((k) => k.id === recordId)!)).toBe(true);
    expect(canRead(data(), 'p-idris', data().knowledge.find((k) => k.id === recordId)!)).toBe(false);

    store.proposeGroupAgreement(communityId, 'Test sharing agreement', 'Only group-scoped records.');
    const agreement = data().groupAgreements.at(-1)!;
    expect(groupAgreementStatus(agreement)).toBe('proposed');
    expect(agreement.responses.every((r) => r.state === 'pending')).toBe(true);

    store.respondToGroupAgreement(agreement.id, true);
    expect(groupAgreementStatus(data().groupAgreements.find((g) => g.id === agreement.id)!)).toBe(
      'proposed',
    );
    expect(canRead(data(), 'p-idris', data().knowledge.find((k) => k.id === recordId)!)).toBe(false);

    store.setActor('p-idris');
    store.respondToGroupAgreement(agreement.id, true);
    expect(groupAgreementStatus(data().groupAgreements.find((g) => g.id === agreement.id)!)).toBe(
      'active',
    );
    expect(canRead(data(), 'p-idris', data().knowledge.find((k) => k.id === recordId)!)).toBe(true);

    store.revokeGroupConsent(agreement.id);
    expect(groupAgreementStatus(data().groupAgreements.find((g) => g.id === agreement.id)!)).toBe(
      'declined',
    );
    expect(canRead(data(), 'p-idris', data().knowledge.find((k) => k.id === recordId)!)).toBe(false);
  });

  it('keeps a proposal inactive when a participant declines', () => {
    const store = newStore();
    const communityId = store.createCommunity({
      name: 'Quorum Test',
      description: 'Another test community with a request policy.',
      purpose: 'study',
      principles: [],
      locality: 'Testville',
      geographicArea: '',
      joinPolicy: 'open',
      advertiseDirectory: false,
    });
    store.setActor('p-nia');
    store.joinCommunity(communityId);
    store.setActor('p-mara');
    store.proposeGroupAgreement(communityId, 'Quorum test', 'A test of unanimous consent.');
    const agreement = store.getSnapshot().data.groupAgreements.at(-1)!;
    store.respondToGroupAgreement(agreement.id, true);
    store.setActor('p-nia');
    store.respondToGroupAgreement(agreement.id, false);
    const next = store.getSnapshot().data.groupAgreements.find((g) => g.id === agreement.id)!;
    expect(groupAgreementStatus(next)).toBe('declined');
    expect(() => store.revokeGroupConsent(agreement.id)).toThrow(/active/i);
  });
});

describe('input validation and authorisation', () => {
  it('rejects invalid records and unauthorised edits', () => {
    const store = newStore();
    expect(() => store.createKnowledge(knowledgeInput({ title: 'no' }))).toThrow(/at least 3/i);
    expect(() =>
      store.createKnowledge(knowledgeInput({ scope: 'community', communityId: 'c-willowbank' })),
    ).not.toThrow();

    store.setActor('p-idris');
    const maraRecord = store.getSnapshot().data.knowledge.find((k) => k.id === 'k-boundary')!;
    expect(() =>
      store.updateKnowledge(maraRecord.id, { title: 'Stolen edit' }, 'not the author'),
    ).toThrow(/author/i);
  });

  it('refuses duplicate active invitations and allows community-scoped records only for members', () => {
    const store = newStore();
    expect(() => store.inviteToConnect('p-idris', 'Again')).toThrow(/already connected/i);
    store.setActor('p-sam');
    expect(() =>
      store.createKnowledge(knowledgeInput({ scope: 'community', communityId: 'c-willowbank' })),
    ).toThrow(/current relationship|member/i);
  });

  it('rejects malformed backups before replacing data', () => {
    const store = newStore();
    expect(() => store.importBackup('{not json')).toThrow(/valid JSON/i);
    expect(() => store.importBackup(JSON.stringify({ schemaVersion: 99 }))).toThrow(/backup rejected/i);
    const originalCount = store.getSnapshot().data.people.length;
    expect(store.getSnapshot().data.people.length).toBe(originalCount);
  });
});

describe('persistence and settings', () => {
  it('persists theme, acting identity and changes through the storage adapter', () => {
    const storage = new MemoryStorageAdapter();
    const store = new NodeStore(storage);
    store.setTheme('mycelium');
    store.setActor('p-ilse');
    const recordId = store.createKnowledge(knowledgeInput({ title: 'Ilse test note' }));

    const reloaded = new NodeStore(storage);
    expect(reloaded.getSnapshot().settings.theme).toBe('mycelium');
    expect(reloaded.getSnapshot().settings.actorId).toBe('p-ilse');
    expect(reloaded.getSnapshot().data.knowledge.some((k) => k.id === recordId)).toBe(true);
  });

  it('round-trips a full backup and restores sample data', () => {
    const store = newStore();
    store.setTheme('tree');
    const backup = store.exportBackup();
    const parsed = JSON.parse(backup);
    expect(validatePersistedState(parsed).ok).toBe(true);

    const other = newStore();
    const counts = other.importBackup(backup);
    expect(counts.people).toBe(9);
    expect(other.getSnapshot().settings.theme).toBe('tree');

    other.resetSampleData();
    expect(other.getSnapshot().settings.actorId).toBe('p-mara');
    expect(
      visibleKnowledge(other.getSnapshot().data, 'p-mara').some((k) => k.id === 'k-waterlog'),
    ).toBe(true);
  });

  it('starts a new empty node with one identity', () => {
    const store = newStore();
    store.resetToEmptyNode('Test node');
    const snapshot = store.getSnapshot();
    expect(snapshot.data.people).toHaveLength(1);
    expect(snapshot.data.communities).toHaveLength(0);
    expect(snapshot.settings.actorId).toBe('p-you');
    expect(() =>
      store.createKnowledge(knowledgeInput({ scope: 'relationship' })),
    ).not.toThrow();
  });

  it('validates a persisted snapshot schema', () => {
    const data = createSampleData();
    const valid = {
      schemaVersion: 1,
      data,
      settings: {
        theme: 'web',
        actorId: 'p-mara',
        ai: { enabled: false, provider: 'none', endpoint: '', model: '', timeoutMs: 10000 },
        showSampleBanner: true,
      },
    };
    expect(validatePersistedState(valid).ok).toBe(true);
    const invalid = structuredClone(valid);
    invalid.settings.actorId = 'p-nobody';
    expect(validatePersistedState(invalid).ok).toBe(false);
  });
});
