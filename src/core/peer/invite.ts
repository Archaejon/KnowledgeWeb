/**
 * Invite links. Everything travels in the URL fragment (after `#`), which
 * browsers never send to the web host, so the static host never sees the
 * room secret or the inviter's key.
 */
import { fromBase64Url, isPublicKey, toBase64Url } from './crypto';

export interface InvitePayload {
  v: 1;
  /** Invite ID on the inviter's node. */
  id: string;
  /** Shared room secret. */
  room: string;
  /** Inviter's public key. */
  key: string;
  name: string;
  handle: string;
  message?: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}

export function encodeInvite(payload: InvitePayload): string {
  return toBase64Url(encoder.encode(JSON.stringify(payload)));
}

export function decodeInvite(token: string): InvitePayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(fromBase64Url(token)));
  } catch {
    throw new Error('This invite link is damaged or incomplete. Ask for a new one.');
  }
  const value = parsed as Partial<InvitePayload> | null;
  if (!value || value.v !== 1) throw new Error('This invite link is from an unsupported version.');
  if (!isPublicKey(value.key)) throw new Error('This invite link has no valid key.');
  if (typeof value.room !== 'string' || !/^[A-Za-z0-9_-]{24,64}$/.test(value.room)) {
    throw new Error('This invite link has no valid room.');
  }
  if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(value.id)) {
    throw new Error('This invite link has no valid ID.');
  }
  const name = cleanText(value.name, 80);
  if (!name) throw new Error('This invite link does not say who it is from.');
  return {
    v: 1,
    id: value.id,
    room: value.room,
    key: value.key,
    name,
    handle: cleanText(value.handle, 40),
    message: cleanText(value.message, 500) || undefined,
  };
}

/** The app's own address (without any fragment) plus the invite route. */
export function inviteUrl(appUrl: string, token: string): string {
  return `${appUrl.split('#')[0]}#/connect/${token}`;
}
