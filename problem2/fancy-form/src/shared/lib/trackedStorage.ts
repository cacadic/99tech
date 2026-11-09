import type { StateStorage } from "zustand/middleware";

export interface TrackedStorage extends StateStorage {
  getItem: (name: string) => string | null;
  /**
   * True when the stored value is not what THIS tab last read or wrote, i.e. another tab changed it.
   * A failed write does not count as a change (the stored value is still what we last saw), so a tab whose
   * storage refuses writes never "catches up" to an older stored wallet and rolls its own state back.
   */
  changedElsewhere: (name: string) => boolean;
}

/**
 * `localStorage` that never throws (Safari private mode, blocked storage, quota exceeded) and remembers what
 * this tab last saw. Not persisting is a degraded mode, not an error: the in-memory state is still correct.
 */
export function createTrackedStorage(
  storage: () => Storage = () => window.localStorage,
): TrackedStorage {
  const seen = new Map<string, string | null>();

  const read = (name: string): string | null => {
    try {
      return storage().getItem(name);
    } catch {
      return null;
    }
  };

  return {
    getItem: (name) => {
      const value = read(name);
      seen.set(name, value);
      return value;
    },
    setItem: (name, value) => {
      try {
        storage().setItem(name, value);
        seen.set(name, value);
      } catch {
        // Quota exceeded or storage blocked: keep going without persistence.
      }
    },
    removeItem: (name) => {
      try {
        storage().removeItem(name);
        seen.set(name, null);
      } catch {
        // Same as above.
      }
    },
    changedElsewhere: (name) => seen.has(name) && read(name) !== seen.get(name),
  };
}
