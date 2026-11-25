/**
 * Peer manager: keeps one live meeting room per invite or connection, proves
 * identity on every connection, and moves knowledge between two nodes.
 *
 * It owns no data. Every change goes through NodeStore commands, so the access
 * engine, validation and consent log apply exactly as for local edits.
 *
 * Flow:
 *   inviter: createInvite → link → (friend opens it)
 *   invitee: acceptInvite → joins room → sends `request`
 *   inviter: sees the request with the friend's key fingerprint → confirm
 *            → `confirm` → both sides active → `sync` both ways
 *   either:  edits push a fresh `sync`; revoke sends `revoke`
 */
import type { NodeStore } from '../store';
import type { NodeData, PersonRelationship } from '../types';
import { fingerprintOf, personIdFor, randomToken, roomIdFor, signText, verifyText, isPublicKey, generateKeyPair } from './crypto';
import { encodeInvite, inviteUrl } from './invite';
import type { InvitePayload } from './invite';
import type { KeyStore, StoredKey } from './keystore';
import { PROTOCOL, outgoingRecords, parseWire, payloadSignature, profileOf } from './sync';
import type { PeerProfile, WireMessage } from './sync';

// ------------------------------------------------------------ transport seam

export interface HandshakeMessage {
  data: unknown;
}
export type Handshake = (
  peerId: string,
  send: (data: Record<string, string | number>) => Promise<void>,
  receive: () => Promise<HandshakeMessage>,
) => Promise<void>;

/** The few room features the manager needs; trystero or a test double provides them. */
export interface RoomLike {
  onPeerJoin: ((peerId: string) => void) | null;
  onPeerLeave: ((peerId: string) => void) | null;
  onMessage: ((data: unknown, peerId: string) => void) | null;
  send(data: WireMessage, target: string): Promise<void>;
  leave(): Promise<void>;
}

export type JoinFn = (roomId: string, password: string, handshake: Handshake) => RoomLike;

// --------------------------------------------------------------- UI state

export interface JoinRequest {
  id: string;
  inviteId: string;
  secret: string;
  peerId: string;
  publicKey: string;
  personId: string;
  fingerprint: string;
  profile: PeerProfile;
}

export type PeerStatus =
  | { kind: 'no-identity' }
  | { kind: 'starting' }
  | { kind: 'missing-key' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

export interface PeerState {
  status: PeerStatus;
  /** Authenticated peers currently connected, per room secret. */
  online: Record<string, number>;
  requests: JoinRequest[];
  /** Short, content-free activity lines for the Connect page. */
  activity: { at: string; text: string }[];
}

interface AuthedPeer {
  publicKey: string;
  personId: string;
  fingerprint: string;
}

interface RoomState {
  room: RoomLike;
  peers: Map<string, AuthedPeer>;
  lastSent?: string;
}

const HELLO = 'hello';
const PROOF = 'proof';

export class PeerManager {
  private state: PeerState = { status: { kind: 'starting' }, online: {}, requests: [], activity: [] };
  private listeners = new Set<() => void>();
  private rooms = new Map<string, RoomState>();
  private key: StoredKey | null = null;
  private ownerId: string | undefined;
  private join: JoinFn | null = null;
  private unsubscribe: (() => void) | null = null;
  private reconciling = false;

  constructor(
    private readonly store: NodeStore,
    private readonly keys: KeyStore,
    private readonly loadJoin: () => Promise<JoinFn>,
  ) {}

  // ---------------------------------------------------------- subscription

  getState = (): PeerState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(patch: Partial<PeerState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  private note(text: string) {
    this.setState({ activity: [{ at: new Date().toISOString(), text }, ...this.state.activity].slice(0, 20) });
  }

  private setOnline(secret: string) {
    const count = this.rooms.get(secret)?.peers.size ?? 0;
    const online = { ...this.state.online };
    if (count > 0) online[secret] = count;
    else delete online[secret];
    this.setState({ online });
  }

  // ------------------------------------------------------------- lifecycle

  async start() {
    if (!this.unsubscribe) this.unsubscribe = this.store.subscribe(() => void this.onStoreChange());
    await this.loadIdentity();
  }

  async stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    await Promise.all([...this.rooms.keys()].map((secret) => this.leaveRoom(secret)));
  }

  private get data(): NodeData {
    return this.store.getSnapshot().data;
  }

  private async loadIdentity() {
    const ownerId = this.data.node.ownerId;
    this.ownerId = ownerId;
    this.key = null;
    await Promise.all([...this.rooms.keys()].map((secret) => this.leaveRoom(secret)));
    if (!ownerId) {
      this.setState({ status: { kind: 'no-identity' }, requests: [] });
      return;
    }
    try {
      const key = await this.keys.load(ownerId);
      const owner = this.data.people.find((p) => p.id === ownerId);
      if (!key || key.publicKey !== owner?.publicKey) {
        this.setState({ status: { kind: 'missing-key' } });
        return;
      }
      this.key = key;
      this.setState({ status: { kind: 'ready' } });
      await this.reconcile();
    } catch (error) {
      this.setState({ status: { kind: 'error', message: errorText(error) } });
    }
  }

  private async onStoreChange() {
    if (this.data.node.ownerId !== this.ownerId) {
      await this.loadIdentity();
      return;
    }
    await this.reconcile();
    await this.pushChanges();
  }

  // ------------------------------------------------------------ commands

  /** Make a key pair and replace this node with one owned by it. */
  async createIdentity(name: string, handle: string) {
    const { privateKey, publicKey } = await generateKeyPair().catch(() => {
      throw new Error('This browser cannot make Ed25519 keys. Update it, or try a current Firefox, Chrome or Safari.');
    });
    const personId = await personIdFor(publicKey);
    await this.keys.save(personId, { publicKey, privateKey });
    this.store.createOwnedNode({ personId, publicKey, fingerprint: await fingerprintOf(publicKey), name, handle });
    await this.loadIdentity();
  }

  /** Create an invite and return its link. */
  createInvite(appUrl: string, message = ''): string {
    const owner = this.ownerPerson();
    const invite = this.store.createPeerInvite(randomToken(24), message);
    return inviteUrl(appUrl, encodeInvite(this.payloadFor(invite.id, invite.room, owner.name, owner.handle, invite.message)));
  }

  /** Rebuild the link for an invite that is still open. */
  linkFor(appUrl: string, inviteId: string): string | null {
    const owner = this.ownerPerson();
    const invite = this.data.invites?.find((i) => i.id === inviteId && i.status === 'open');
    if (!invite) return null;
    return inviteUrl(appUrl, encodeInvite(this.payloadFor(invite.id, invite.room, owner.name, owner.handle, invite.message)));
  }

  async acceptInvite(invite: InvitePayload): Promise<string> {
    if (!isPublicKey(invite.key)) throw new Error('That invite has no valid key.');
    const relationshipId = this.store.acceptPeerInvite({
      inviterId: await personIdFor(invite.key),
      inviterKey: invite.key,
      fingerprint: await fingerprintOf(invite.key),
      profile: { name: invite.name, handle: invite.handle, locality: '', bio: '' },
      room: invite.room,
    });
    await this.reconcile();
    return relationshipId;
  }

  async confirmRequest(requestId: string) {
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request) throw new Error('That request has gone. Ask your friend to open the link again.');
    this.store.admitPeer({
      inviteId: request.inviteId,
      personId: request.personId,
      publicKey: request.publicKey,
      fingerprint: request.fingerprint,
      profile: request.profile,
    });
    const room = this.rooms.get(request.secret);
    // Anyone else waiting on the same invite is told no.
    for (const other of this.state.requests.filter((r) => r.secret === request.secret && r.id !== request.id)) {
      await room?.room.send({ t: 'decline' }, other.peerId).catch(() => undefined);
    }
    this.setState({ requests: this.state.requests.filter((r) => r.secret !== request.secret) });
    await room?.room.send({ t: 'confirm' }, request.peerId).catch(() => undefined);
    this.note(`Connected with ${request.profile.name}.`);
    await this.sendSync(request.secret, request.peerId, true);
  }

  async declineRequest(requestId: string) {
    const request = this.state.requests.find((r) => r.id === requestId);
    if (!request) return;
    await this.rooms.get(request.secret)?.room.send({ t: 'decline' }, request.peerId).catch(() => undefined);
    this.setState({ requests: this.state.requests.filter((r) => r.id !== requestId) });
  }

  // ------------------------------------------------------------- internals

  private ownerPerson() {
    const owner = this.data.people.find((p) => p.id === this.data.node.ownerId);
    if (!owner?.publicKey) throw new Error('Create your own node first.');
    return owner;
  }

  private payloadFor(id: string, room: string, name: string, handle: string, message?: string): InvitePayload {
    return { v: 1, id, room, key: this.ownerPerson().publicKey!, name, handle, message };
  }

  /** Which relationship or open invite a room secret belongs to right now. */
  private contextFor(secret: string):
    | { kind: 'relationship'; rel: PersonRelationship; partnerId: string }
    | { kind: 'invite'; inviteId: string }
    | null {
    const data = this.data;
    const rel = data.relationships
      .filter((r) => r.peer?.room === secret)
      .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt))[0];
    if (rel) return { kind: 'relationship', rel, partnerId: rel.aId === this.ownerId ? rel.bId : rel.aId };
    const invite = data.invites?.find((i) => i.room === secret && i.status === 'open');
    return invite ? { kind: 'invite', inviteId: invite.id } : null;
  }

  private wantedRooms(): Set<string> {
    const wanted = new Set<string>();
    if (!this.key) return wanted;
    for (const invite of this.data.invites ?? []) if (invite.status === 'open') wanted.add(invite.room);
    for (const rel of this.data.relationships) {
      if (!rel.peer) continue;
      if (rel.status === 'active') wanted.add(rel.peer.room);
      if (rel.status === 'pending' && rel.initiatedBy !== this.ownerId) wanted.add(rel.peer.room);
      if (rel.status === 'revoked' && rel.peer.revokeNoticePending) wanted.add(rel.peer.room);
    }
    return wanted;
  }

  private async reconcile() {
    if (this.reconciling || !this.key) return;
    this.reconciling = true;
    try {
      const wanted = this.wantedRooms();
      for (const secret of [...this.rooms.keys()]) if (!wanted.has(secret)) await this.leaveRoom(secret);
      for (const secret of wanted) if (!this.rooms.has(secret)) await this.joinRoom(secret);
    } catch (error) {
      this.setState({ status: { kind: 'error', message: errorText(error) } });
    } finally {
      this.reconciling = false;
    }
  }

  private async joinRoom(secret: string) {
    if (!this.join) this.join = await this.loadJoin();
    const roomId = await roomIdFor(secret);
    if (this.rooms.has(secret) || !this.wantedRooms().has(secret)) return;
    const peers = new Map<string, AuthedPeer>();
    const room = this.join(roomId, secret, (peerId, send, receive) => this.handshake(roomId, secret, peerId, peers, send, receive));
    const state: RoomState = { room, peers };
    this.rooms.set(secret, state);
    room.onPeerJoin = (peerId) => void this.onPeerJoin(secret, peerId);
    room.onPeerLeave = (peerId) => {
      peers.delete(peerId);
      this.setState({ requests: this.state.requests.filter((r) => r.peerId !== peerId) });
      this.setOnline(secret);
    };
    room.onMessage = (data, peerId) => void this.onMessage(secret, peerId, data);
  }

  private async leaveRoom(secret: string) {
    const state = this.rooms.get(secret);
    if (!state) return;
    this.rooms.delete(secret);
    await state.room.leave().catch(() => undefined);
    this.setState({ requests: this.state.requests.filter((r) => r.secret !== secret) });
    this.setOnline(secret);
  }

  /**
   * Mutual proof of key possession, run before a peer counts as joined. Each
   * side signs the other's fresh nonce together with both keys and the room,
   * so a signature cannot be replayed into another room or session.
   */
  private async handshake(
    roomId: string,
    secret: string,
    peerId: string,
    peers: Map<string, AuthedPeer>,
    send: (data: Record<string, string | number>) => Promise<void>,
    receive: () => Promise<HandshakeMessage>,
  ) {
    const key = this.key;
    if (!key) throw new Error('No identity key.');
    const nonce = randomToken(16);
    await send({ t: HELLO, p: PROTOCOL, key: key.publicKey, nonce });
    const hello = (await receive()).data as Record<string, unknown>;
    if (hello?.t !== HELLO || hello.p !== PROTOCOL || !isPublicKey(hello.key) || typeof hello.nonce !== 'string') {
      throw new Error('Unrecognised peer.');
    }
    const theirKey = hello.key;
    const sig = await signText(key.privateKey, `${PROTOCOL}|${roomId}|${hello.nonce}|${theirKey}|${key.publicKey}`);
    await send({ t: PROOF, sig });
    const proof = (await receive()).data as Record<string, unknown>;
    const ok =
      proof?.t === PROOF &&
      typeof proof.sig === 'string' &&
      (await verifyText(theirKey, proof.sig, `${PROTOCOL}|${roomId}|${nonce}|${key.publicKey}|${theirKey}`));
    if (!ok) throw new Error('Peer could not prove its key.');
    if (theirKey === key.publicKey) throw new Error('That is this node.');
    const context = this.contextFor(secret);
    if (!context) throw new Error('Room is not in use.');
    if (context.kind === 'relationship' && context.rel.peer?.partnerKey !== theirKey) {
      throw new Error('Unexpected key in this room.');
    }
    peers.set(peerId, {
      publicKey: theirKey,
      personId: await personIdFor(theirKey),
      fingerprint: await fingerprintOf(theirKey),
    });
  }

  private async onPeerJoin(secret: string, peerId: string) {
    const state = this.rooms.get(secret);
    if (!state?.peers.has(peerId)) {
      // The handshake did not pass; never talk to an unauthenticated peer.
      return;
    }
    this.setOnline(secret);
    const context = this.contextFor(secret);
    if (context?.kind !== 'relationship') return;
    const { rel } = context;
    if (rel.status === 'active') {
      this.note(`${this.nameOf(context.partnerId)} is online.`);
      await this.sendSync(secret, peerId, true);
    } else if (rel.status === 'pending' && rel.initiatedBy !== this.ownerId) {
      await state.room.send({ t: 'request', profile: profileOf(this.ownerPerson()) }, peerId);
      this.note(`Asked ${this.nameOf(context.partnerId)} to confirm the connection.`);
    } else if (rel.status === 'revoked' && rel.peer?.revokeNoticePending) {
      await state.room.send({ t: 'revoke' }, peerId);
      this.store.markRevokeDelivered(rel.id);
      this.note(`Told ${this.nameOf(context.partnerId)} the connection has ended.`);
    }
  }

  private async onMessage(secret: string, peerId: string, raw: unknown) {
    const peer = this.rooms.get(secret)?.peers.get(peerId);
    const message = parseWire(raw);
    if (!peer || !message) return;
    const context = this.contextFor(secret);
    if (!context) return;
    try {
      if (context.kind === 'invite') {
        if (message.t !== 'request') return;
        const request: JoinRequest = {
          id: `${secret}:${peer.publicKey}`,
          inviteId: context.inviteId,
          secret,
          peerId,
          publicKey: peer.publicKey,
          personId: peer.personId,
          fingerprint: peer.fingerprint,
          profile: message.profile,
        };
        this.setState({ requests: [...this.state.requests.filter((r) => r.id !== request.id), request] });
        this.note(`${message.profile.name} accepted your invite and is waiting for you to confirm.`);
        return;
      }
      const { rel, partnerId } = context;
      if (peer.personId !== partnerId) return;
      switch (message.t) {
        case 'request':
          // They missed our confirmation (offline at the time); repeat it.
          if (rel.status === 'active' && rel.initiatedBy === this.ownerId) {
            await this.rooms.get(secret)?.room.send({ t: 'confirm' }, peerId);
            await this.sendSync(secret, peerId, true);
          }
          return;
        case 'confirm':
          if (rel.status === 'pending') {
            this.store.settlePeerInvite(rel.id, true);
            this.note(`${this.nameOf(partnerId)} confirmed the connection.`);
            await this.sendSync(secret, peerId, true);
          }
          return;
        case 'decline':
          if (rel.status === 'pending') {
            this.store.settlePeerInvite(rel.id, false);
            this.note(`${this.nameOf(partnerId)} did not confirm the connection.`);
          }
          return;
        case 'sync': {
          if (rel.status !== 'active') return;
          const result = this.store.applyPeerSync(rel.id, message.profile, message.records);
          this.note(
            `Received ${result.received} record${result.received === 1 ? '' : 's'} from ${message.profile.name}` +
              (result.refused ? `, refused ${result.refused}` : '') +
              (result.attachmentsDropped ? `, left out ${result.attachmentsDropped} attachment(s) for space` : '') +
              '.',
          );
          return;
        }
        case 'revoke':
          this.store.applyPeerRevoke(rel.id);
          this.note(`${this.nameOf(partnerId)} ended the connection.`);
          return;
      }
    } catch (error) {
      this.note(`Could not process a message: ${errorText(error)}`);
    }
  }

  private async sendSync(secret: string, peerId: string | null, force: boolean) {
    const state = this.rooms.get(secret);
    const context = this.contextFor(secret);
    if (!state || context?.kind !== 'relationship' || context.rel.status !== 'active') return;
    const owner = this.ownerPerson();
    const profile = profileOf(owner);
    const records = outgoingRecords(this.data, owner.id, context.partnerId);
    const signature = payloadSignature(profile, records);
    if (!force && signature === state.lastSent) return;
    state.lastSent = signature;
    const targets = peerId ? [peerId] : [...state.peers.keys()];
    for (const target of targets) {
      await state.room.send({ t: 'sync', profile, records }, target).catch((error) => {
        state.lastSent = undefined;
        this.note(`Could not send to ${this.nameOf(context.partnerId)}: ${errorText(error)}`);
      });
    }
  }

  /** After a local edit, send fresh data to every connected partner whose view changed. */
  private async pushChanges() {
    for (const [secret, state] of [...this.rooms]) {
      if (state.peers.size === 0) continue;
      const context = this.contextFor(secret);
      if (context?.kind === 'relationship' && context.rel.status === 'revoked' && context.rel.peer?.revokeNoticePending) {
        // Revoked while they were connected: tell them now rather than at the next reconnect.
        for (const peerId of state.peers.keys()) await state.room.send({ t: 'revoke' }, peerId).catch(() => undefined);
        this.store.markRevokeDelivered(context.rel.id);
        this.note(`Told ${this.nameOf(context.partnerId)} the connection has ended.`);
        continue;
      }
      await this.sendSync(secret, null, false);
    }
  }

  private nameOf(personId: string): string {
    return this.data.people.find((p) => p.id === personId)?.name ?? 'Your friend';
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
