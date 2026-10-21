/**
 * Storage adapters.
 *
 * The application only depends on this tiny interface. A future node daemon
 * can implement the same interface against SQLite, a file, or a remote sync
 * service without changing the store or UI. See docs/architecture.md.
 */
export const STORAGE_KEY = 'understory.node.v1';

/** Suffix used for a copy of saved data that could not be read. */
export const RECOVERY_SUFFIX = '.unreadable';

export interface StorageAdapter {
  readonly kind: string;
  load(): string | null;
  save(value: string): void;
  clear(): void;
  /**
   * Best-effort copy of data that failed validation, taken before the node is
   * replaced. Returns the key the copy was stored under, or null when the copy
   * could not be kept (no permission, no space). Optional so a minimal adapter
   * can omit it; the store reports the loss instead of pretending.
   */
  preserve?(value: string): string | null;
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

  preserve(value: string): string | null {
    const key = `${this.key}${RECOVERY_SUFFIX}`;
    try {
      window.localStorage.setItem(key, value);
      return key;
    } catch {
      return null;
    }
  }
}

export class MemoryStorageAdapter implements StorageAdapter {
  readonly kind = 'memory';
  private value: string | null = null;
  recovered: string | null = null;

  constructor(private readonly key = STORAGE_KEY) {}

  load(): string | null {
    return this.value;
  }

  save(value: string): void {
    this.value = value;
  }

  clear(): void {
    this.value = null;
  }

  /** A memory copy only lasts for this session, so it is kept for inspection. */
  preserve(value: string): string {
    this.recovered = value;
    return `${this.key}${RECOVERY_SUFFIX} (this session only)`;
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
