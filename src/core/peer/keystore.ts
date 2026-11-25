/**
 * Private keys live in IndexedDB as non-extractable CryptoKey objects. They are
 * never written into the node JSON, backups or exports, so a backup restored in
 * another browser has the owner's public identity but cannot sign as them.
 */
const DB_NAME = 'understory.keys';
const STORE = 'keys';

export interface StoredKey {
  publicKey: string;
  privateKey: CryptoKey;
}

export interface KeyStore {
  load(personId: string): Promise<StoredKey | null>;
  save(personId: string, key: StoredKey): Promise<void>;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Key storage is unavailable.'));
  });
}

export class IndexedDbKeyStore implements KeyStore {
  async load(personId: string): Promise<StoredKey | null> {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(personId);
        request.onsuccess = () => resolve((request.result as StoredKey | undefined) ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }

  async save(personId: string, key: StoredKey): Promise<void> {
    const db = await open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(key, personId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
}

export class MemoryKeyStore implements KeyStore {
  private keys = new Map<string, StoredKey>();
  async load(personId: string) {
    return this.keys.get(personId) ?? null;
  }
  async save(personId: string, key: StoredKey) {
    this.keys.set(personId, key);
  }
}
