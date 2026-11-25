/**
 * WebRTC transport through trystero. Peers find each other through public
 * Nostr relays; the relays only carry connection-setup messages, which
 * trystero encrypts with the room secret. Records then travel over a direct,
 * DTLS-encrypted WebRTC data channel between the two browsers.
 *
 * Loaded on demand so the entry bundle stays small for people who never connect.
 */
import { joinRoom } from 'trystero';
import type { JsonValue } from 'trystero';
import type { JoinFn, RoomLike } from './manager';
import type { WireMessage } from './sync';

const APP_ID = 'understory-knowledge-node-v1';
/** Ceiling for one incoming message: a full sync with attachments fits well under it. */
const MAX_RECEIVE_BYTES = 24 * 1024 * 1024;

export const join: JoinFn = (roomId, password, handshake) => {
  const room = joinRoom({ appId: APP_ID, password, maxReceiveBytes: MAX_RECEIVE_BYTES }, roomId, {
    handshakeTimeoutMs: 20_000,
    onPeerHandshake: (peerId, send, receive) =>
      handshake(peerId, (data) => send(data as JsonValue), receive),
  });
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
