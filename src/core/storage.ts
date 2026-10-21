/**
 * Storage adapters.
 *
 * The application only depends on this tiny interface. A future node daemon
 * can implement the same interface against SQLite, a file, or a remote sync
 * service without changing the store or UI. See docs/architecture.md.
 */
export const STORAGE_KEY = 'understory.node.v1';

export interface StorageAdapter {
  readonly kind: string;
  load(): string | null;
  save(value: string): void;
  clear(): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'browser-localstorage';

  constructor(private readonly key = STORAGE_KEY) {}

  load(): string | null {
    return window.localStorage.getItem(this.key);
  }

  save(value: string): void {
    window.localStorage.setItem(this.key, value);
  }

  clear(): void {
    window.localStorage.removeItem(this.key);
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly kind = 'memory';
  private value: string | null = null;

  load(): string | null {
    return this.value;
  }

  save(value: string): void {
    this.value = value;
  }

  clear(): void {
    this.value = null;
  }
}

export function createStorage(): StorageAdapter {
  try {
    const probe = '__understory_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return new LocalStorageAdapter();
  } catch {
    // Private browsing or blocked storage: the app still works for this session.
    return new MemoryStorageAdapter();
  }
}
