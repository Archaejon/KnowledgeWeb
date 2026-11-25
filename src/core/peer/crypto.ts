/**
 * Real node identity: an Ed25519 key pair made with the browser's Web Crypto.
 *
 * The private key is created non-extractable, so page script can sign with it
 * but cannot read or export its bytes. The public key is shared in invite links
 * and proves, during every connection, that the other side is the same node.
 */

const encoder = new TextEncoder();

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error('Not base64url.');
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomToken(byteLength = 24): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isPublicKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return fromBase64Url(value).length === 32;
  } catch {
    return false;
  }
}

/** Human-comparable fingerprint: 8 groups of 4 hex digits from SHA-256(key). */
export async function fingerprintOf(publicKey: string): Promise<string> {
  const digest = hex(await sha256(fromBase64Url(publicKey)));
  return digest.slice(0, 32).match(/.{4}/g)!.join(' ');
}

/** Stable person ID derived from the public key, identical on every node. */
export async function personIdFor(publicKey: string): Promise<string> {
  return `pk-${hex(await sha256(fromBase64Url(publicKey))).slice(0, 20)}`;
}

/** Meeting-room name derived from the shared secret, so the secret itself is never published. */
export async function roomIdFor(secret: string): Promise<string> {
  return hex(await sha256(encoder.encode(`understory/room/v1|${secret}`))).slice(0, 40);
}

export async function generateKeyPair(): Promise<{ privateKey: CryptoKey; publicKey: string }> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, false, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { privateKey: pair.privateKey, publicKey: toBase64Url(raw) };
}

export async function signText(privateKey: CryptoKey, text: string): Promise<string> {
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, encoder.encode(text));
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyText(publicKey: string, signature: string, text: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', fromBase64Url(publicKey), { name: 'Ed25519' }, false, [
      'verify',
    ]);
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, fromBase64Url(signature), encoder.encode(text));
  } catch {
    return false;
  }
}
