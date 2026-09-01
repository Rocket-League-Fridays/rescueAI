/**
 * Namespaced JSON persistence over `sessionStorage`.
 *
 * Every access is guarded: `sessionStorage` is absent during prerender and throws outright in
 * some privacy modes, and a half-written value must never take a page down. When storage is
 * unusable the store silently degrades to an in-memory map for the life of the tab.
 */
export interface JsonStore<T> {
  read(key: string): T | null;
  write(key: string, value: T): void;
  clear(key: string): void;
}

class SessionJsonStore<T> implements JsonStore<T> {
  private readonly fallback = new Map<string, T>();

  constructor(private readonly namespace: string) {}

  read(key: string): T | null {
    const storage = this.storage();
    if (storage === null) {
      return this.fallback.get(key) ?? null;
    }
    try {
      const raw = storage.getItem(this.storageKey(key));
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return this.fallback.get(key) ?? null;
    }
  }

  write(key: string, value: T): void {
    this.fallback.set(key, value);
    const storage = this.storage();
    if (storage === null) {
      return;
    }
    try {
      storage.setItem(this.storageKey(key), JSON.stringify(value));
    } catch {
      // Quota or a locked-down browser: the in-memory copy above still serves this tab.
    }
  }

  clear(key: string): void {
    this.fallback.delete(key);
    const storage = this.storage();
    if (storage === null) {
      return;
    }
    try {
      storage.removeItem(this.storageKey(key));
    } catch {
      // Nothing to recover from — the value is already gone from memory.
    }
  }

  private storageKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  private storage(): Storage | null {
    if (typeof window === "undefined") {
      return null;
    }
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  }
}

export function createJsonStore<T>(namespace: string): JsonStore<T> {
  return new SessionJsonStore<T>(namespace);
}
