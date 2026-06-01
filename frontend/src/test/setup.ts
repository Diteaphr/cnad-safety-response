import '@testing-library/jest-dom/vitest';

/** Vitest + jsdom 25 can expose a broken `localStorage`; provide a full Storage mock. */
function createStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

Object.defineProperty(globalThis, 'localStorage', { value: createStorage(), writable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: createStorage(), writable: true });
