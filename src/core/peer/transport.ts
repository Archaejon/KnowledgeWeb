/**
 * WebRTC transport through trystero. Peers find each other through public
 * Nostr relays; the relays only carry connection-setup messages, which
 * trystero encrypts with the room secret. Records then travel over a direct,
 * DTLS-encrypted WebRTC data channel between the two browsers.
 *
 * Loaded on demand so the entry bundle stays small for people who never connect.
 */
import { joinRoom, getRelaySockets } from 'trystero';
import type { JsonValue } from 'trystero';
import type { JoinFn, RoomLike } from './manager';
import type { WireMessage } from './sync';

const APP_ID = 'understory-knowledge-node-v1';
/** Ceiling for one incoming message: a full sync with attachments fits well under it. */
const MAX_RECEIVE_BYTES = 24 * 1024 * 1024;

/**
 * Relays both sides use. Pinned rather than trystero's rotating default pick,
 * which on 2026-11-26 included two dead relays. Each of these passed an
 * ephemeral-event round trip (the kind trystero publishes) that day. Both
 * browsers must share at least one working relay, so every node uses the same
 * list; changing it is a compatibility change between app versions.
 */
export const RELAY_URLS = [
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://relay.snort.social',
  'wss://offchain.pub',
  'wss://relay.nostr.net',
];

export interface RelayHealth {
  open: number;
  total: number;
}

/** How many relay sockets are open right now. `total` is 0 before any room is joined. */
export function relayHealth(): RelayHealth {
  const sockets = Object.values(getRelaySockets()) as (WebSocket | undefined)[];
  return { open: sockets.filter((s) => s?.readyState === WebSocket.OPEN).length, total: sockets.length };
}

export const join: JoinFn = (roomId, password, handshake) => {
  const room = joinRoom(
    { appId: APP_ID, password, maxReceiveBytes: MAX_RECEIVE_BYTES, relayConfig: { urls: RELAY_URLS, warnOnRelayFailure: false } },
    roomId,
    {
      handshakeTimeoutMs: 20_000,
      onPeerHandshake: (peerId, send, receive) => handshake(peerId, (data) => send(data as JsonValue), receive),
    },
  );
  const action = room.makeAction<JsonValue>('msg');
  const adapter: RoomLike = {
    onPeerJoin: null,
    onPeerLeave: null,
    onMessage: null,
    send: (data: WireMessage, target: string) => action.send(data as unknown as JsonValue, { target }),
    leave: () => room.leave(),
  };
  room.onPeerJoin = (peerId) => adapter.onPeerJoin?.(peerId);
  room.onPeerLeave = (peerId) => adapter.onPeerLeave?.(peerId);
  action.onMessage = (data, context) => adapter.onMessage?.(data, context.peerId);
  return adapter;
};
