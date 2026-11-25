import { describe, expect, it } from 'vitest';
import { canRead } from '../src/core/access';
import { NodeStore } from '../src/core/store';
import type { KnowledgeInput } from '../src/core/store';
import { MemoryStorageAdapter } from '../src/core/storage';
import { MemoryKeyStore } from '../src/core/peer/keystore';
import { decodeInvite, encodeInvite, inviteUrl } from '../src/core/peer/invite';
import { cleanIncomingRecord, outgoingRecords, parseWire } from '../src/core/peer/sync';
import { fingerprintOf, generateKeyPair, personIdFor, signText, verifyText } from '../src/core/peer/crypto';
import { PeerManager } from '../src/core/peer/manager';
import type { Handshake, HandshakeMessage, JoinFn, RoomLike } from '../src/core/peer/manager';
import type { WireMessage } from '../src/core/peer/sync';

// ------------------------------------------------------- in-memory transport

class Queue<T> {
  private items: T[] = [];
  private waiters: ((item: T) => void)[] = [];
  push(item: T) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(item);
    else this.items.push(item);
  }
  next(): Promise<T> {
    const item = this.items.shift();
    return item !== undefined ? Promise.resolve(item) : new Promise((resolve) => this.waiters.push(resolve));
  }
}

interface FakeRoom extends RoomLike {
  peerId: string;
  handshake: Handshake;
  links: Map<string, FakeRoom>;
}

/** Rooms with the same ID meet; each pair runs the real handshake before "joining". */
function createHub(options: { tamper?: (data: Record<string, string | number>) => Record<string, string | number> } = {}) {
  const rooms = new Map<string, Set<FakeRoom>>();
  let counter = 0;
  const connect = async (a: FakeRoom, b: FakeRoom) => {
    const toA = new Queue<HandshakeMessage>();
    const toB = new Queue<HandshakeMessage>();
    const results = await Promise.allSettled([
      a.handshake(b.peerId, async (data) => toB.push({ data: structuredClone(options.tamper?.(data) ?? data) }), () => toA.next()),
      b.handshake(a.peerId, async (data) => toA.push({ data: structuredClone(data) }), () => toB.next()),
    ]);
    if (results.some((r) => r.status === 'rejected')) return;
    a.links.set(b.peerId, b);
    b.links.set(a.peerId, a);
    a.onPeerJoin?.(b.peerId);
    b.onPeerJoin?.(a.peerId);
  };
  const join: JoinFn = (roomId, _password, handshake) => {
    const room: FakeRoom = {
      peerId: `peer-${(counter += 1)}`,
      handshake,
      links: new Map(),
      onPeerJoin: null,
      onPeerLeave: null,
      onMessage: null,
      async send(data: WireMessage, target: string) {
        const other = room.links.get(target);
        if (!other) throw new Error('not connected');
        const copy = structuredClone(data);
        queueMicrotask(() => other.onMessage?.(copy, room.peerId));
      },
      async leave() {
        rooms.get(roomId)?.delete(room);
        for (const [id, other] of room.links) {
          other.links.delete(room.peerId);
          other.onPeerLeave?.(room.peerId);
          room.links.delete(id);
        }
      },
    };
    const members = rooms.get(roomId) ?? new Set();
    rooms.set(roomId, members);
    const existing = [...members];
    members.add(room);
    // Handlers are attached right after join returns; meet on the next tick.
    setTimeout(() => existing.forEach((other) => void connect(other, room)), 0);
    return room;
  };
  return { join };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

async function makeNode(hub: { join: JoinFn }, name: string) {
  const store = new NodeStore(new MemoryStorageAdapter());
  const manager = new PeerManager(store, new MemoryKeyStore(), async () => hub.join);
  await manager.start();
  await manager.createIdentity(name, name.toLowerCase());
  return { store, manager, data: () => store.getSnapshot().data };
}

function knowledge(overrides: Partial<KnowledgeInput> = {}): KnowledgeInput {
  return {
    title: 'Seed swap notes',
    body: 'Bring labelled envelopes and a list of what you have.',
    kind: 'note',
    tags: ['seeds'],
    scope: 'relationship',
    links: [],
    sources: [],
    ...overrides,
  };
}

async function connectPair() {
  const hub = createHub();
  const george = await makeNode(hub, 'George');
  const alex = await makeNode(hub, 'Alex');
  const url = george.manager.createInvite('https://example.org/app/#/home');
  const invite = decodeInvite(url.split('#/connect/')[1]);
  await alex.manager.acceptInvite(invite);
  await settle();
  return { hub, george, alex };
}

// ---------------------------------------------------------------------- tests

describe('identity keys', () => {
  it('signs and verifies, and derives the same IDs on every node', async () => {
    const { privateKey, publicKey } = await generateKeyPair();
    const sig = await signText(privateKey, 'hello');
    expect(await verifyText(publicKey, sig, 'hello')).toBe(true);
    expect(await verifyText(publicKey, sig, 'hellO')).toBe(false);
    expect(await personIdFor(publicKey)).toBe(await personIdFor(publicKey));
    expect(await fingerprintOf(publicKey)).toMatch(/^([0-9a-f]{4} ){7}[0-9a-f]{4}$/);
  });
});

describe('invite links', () => {
  it('round-trips through the URL fragment and rejects damaged links', async () => {
    const { publicKey } = await generateKeyPair();
    const token = encodeInvite({ v: 1, id: 'inv-1', room: 'a'.repeat(32), key: publicKey, name: 'George', handle: '@george' });
    const url = inviteUrl('https://example.org/KnowledgeWeb/#/network', token);
    expect(url).toBe(`https://example.org/KnowledgeWeb/#/connect/${token}`);
    expect(decodeInvite(token).name).toBe('George');
    expect(() => decodeInvite(token.slice(0, -6))).toThrow();
    expect(() => decodeInvite(encodeInvite({ v: 1, id: 'inv-1', room: 'short', key: publicKey, name: 'G', handle: '' }))).toThrow(/room/);
  });
});

describe('incoming data is untrusted', () => {
  it('refuses records not authored by the partner or not shared with them', () => {
    const base = { id: 'k-1', title: 'T', body: 'Body', authorId: 'pk-friend', scope: 'relationship' };
    expect(cleanIncomingRecord(base, 'pk-friend')?.title).toBe('T');
    expect(cleanIncomingRecord({ ...base, authorId: 'pk-other' }, 'pk-friend')).toBeNull();
    expect(cleanIncomingRecord({ ...base, scope: 'private' }, 'pk-friend')).toBeNull();
    expect(cleanIncomingRecord({ ...base, scope: 'community' }, 'pk-friend')).toBeNull();
    const cleaned = cleanIncomingRecord(
      { ...base, links: [{ label: 'x', url: 'javascript:alert(1)', kind: 'website' }], projectId: 'pr-1' },
      'pk-friend',
    )!;
    expect(cleaned.links[0].url).toBeUndefined();
    expect(cleaned.projectId).toBeUndefined();
    expect(parseWire({ t: 'sync', profile: { name: '' }, records: [] })).toBeNull();
    expect(parseWire({ t: 'nonsense' })).toBeNull();
  });
});

describe('live connection between two nodes', () => {
  it('needs the inviter to confirm before anything is shared, then syncs both ways', async () => {
    const { george, alex } = await connectPair();
    george.store.createKnowledge(knowledge({ title: 'Pump repair guide' }));
    george.store.createKnowledge(knowledge({ title: 'My private diary', scope: 'private' }));
    alex.store.createKnowledge(knowledge({ title: 'Alex’s compost method' }));
    await settle();

    // Alex accepted; George has not confirmed. Nothing has moved yet.
    expect(george.manager.getState().requests).toHaveLength(1);
    expect(alex.data().knowledge.map((k) => k.title)).toEqual(['Alex’s compost method']);
    const pending = alex.data().relationships[0];
    expect(pending.status).toBe('pending');

    const request = george.manager.getState().requests[0];
    expect(request.profile.name).toBe('Alex');
    expect(request.fingerprint).toBe(alex.data().people[0].keyFingerprint);
    await george.manager.confirmRequest(request.id);
    await settle();

    expect(alex.data().relationships[0].status).toBe('active');
    expect(george.data().relationships[0].status).toBe('active');
    const alexSees = alex.data().knowledge.map((k) => k.title).sort();
    expect(alexSees).toEqual(['Alex’s compost method', 'Pump repair guide']);
    expect(george.data().knowledge.map((k) => k.title)).toContain('Alex’s compost method');
    // The private record never left George's node.
    expect(alex.data().knowledge.some((k) => k.title === 'My private diary')).toBe(false);
    // Received records are readable by the owner through the normal access engine.
    const received = alex.data().knowledge.find((k) => k.title === 'Pump repair guide')!;
    expect(canRead(alex.data(), alex.data().node.ownerId!, received)).toBe(true);
    // Nobody can act as a remote person.
    expect(() => alex.store.setActor(received.authorId)).toThrow(/another node/);
  });

  it('pushes edits, scope changes and deletions while connected', async () => {
    const { george, alex } = await connectPair();
    await george.manager.confirmRequest(george.manager.getState().requests[0].id);
    await settle();
    const id = george.store.createKnowledge(knowledge({ title: 'Draft plan' }));
    await settle();
    expect(alex.data().knowledge.some((k) => k.id === id)).toBe(true);
    george.store.updateKnowledge(id, { title: 'Final plan' }, 'renamed');
    await settle();
    expect(alex.data().knowledge.find((k) => k.id === id)?.title).toBe('Final plan');
    george.store.updateKnowledge(id, { scope: 'private' }, 'made private');
    await settle();
    expect(alex.data().knowledge.some((k) => k.id === id)).toBe(false);
  });

  it('revocation removes held copies on both sides and stops sharing', async () => {
    const { george, alex } = await connectPair();
    await george.manager.confirmRequest(george.manager.getState().requests[0].id);
    george.store.createKnowledge(knowledge({ title: 'Shared once' }));
    alex.store.createKnowledge(knowledge({ title: 'From Alex' }));
    await settle();
    expect(alex.data().knowledge).toHaveLength(2);

    const rel = alex.data().relationships[0];
    alex.store.revokeRelationship(rel.id);
    await settle();
    expect(alex.data().knowledge.map((k) => k.title)).toEqual(['From Alex']);
    expect(george.data().relationships[0].status).toBe('revoked');
    expect(george.data().knowledge.map((k) => k.title)).toEqual(['Shared once']);
    expect(alex.data().relationships[0].peer?.revokeNoticePending).toBe(false);
  });

  it('rejects a stranger who uses an already-claimed invite link', async () => {
    const { hub, george } = await connectPair();
    const url = george.manager.linkFor('https://example.org/', george.data().invites![0].id)!;
    await george.manager.confirmRequest(george.manager.getState().requests[0].id);
    await settle();
    const mallory = await makeNode(hub, 'Mallory');
    await mallory.manager.acceptInvite(decodeInvite(url.split('#/connect/')[1]));
    await settle();
    expect(george.manager.getState().requests).toHaveLength(0);
    expect(mallory.data().relationships[0].status).toBe('pending');
    expect(george.data().relationships).toHaveLength(1);
  });

  it('refuses a peer that cannot prove its key', async () => {
    const hub = createHub({
      tamper: (data) => (data.t === 'proof' ? { ...data, sig: 'AAAA' } : data),
    });
    const george = await makeNode(hub, 'George');
    const alex = await makeNode(hub, 'Alex');
    const url = george.manager.createInvite('https://example.org/');
    await alex.manager.acceptInvite(decodeInvite(url.split('#/connect/')[1]));
    await settle();
    expect(george.manager.getState().requests).toHaveLength(0);
    expect(Object.keys(alex.manager.getState().online)).toHaveLength(0);
  });

  it('sends only what the partner may read', async () => {
    const { george, alex } = await connectPair();
    await george.manager.confirmRequest(george.manager.getState().requests[0].id);
    await settle();
    const data = george.data();
    const partnerId = alex.data().node.ownerId!;
    george.store.createKnowledge(knowledge({ title: 'Public note', scope: 'public' }));
    george.store.createKnowledge(knowledge({ title: 'Secret', scope: 'private' }));
    const titles = outgoingRecords(george.data(), data.node.ownerId!, partnerId).map((k) => k.title);
    expect(titles).toContain('Public note');
    expect(titles).not.toContain('Secret');
  });
});
