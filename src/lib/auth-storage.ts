/**
 * Custom Supabase auth storage adapter.
 *
 * Routes session tokens to either localStorage or sessionStorage based on the
 * 'pp-remember-me' flag (which always lives in localStorage so it survives
 * browser restarts and is readable before any Supabase call).
 *
 * localStorage   → remember me ON  (session survives browser close)
 * sessionStorage → remember me OFF (session cleared when browser closes)
 */

export const REMEMBER_ME_KEY = 'pp-remember-me';

export function getRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setRememberMe(value: boolean): void {
  try {
    localStorage.setItem(REMEMBER_ME_KEY, value ? 'true' : 'false');
  } catch {
    // Storage may be unavailable (private mode, quota exceeded)
  }
}

function getActiveStorage(): Storage {
  return getRememberMe() ? localStorage : sessionStorage;
}

function getInactiveStorage(): Storage {
  return getRememberMe() ? sessionStorage : localStorage;
}

/** Remove all Supabase auth tokens from a given storage. */
export function sweepAuthTokens(store: Storage): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        keys.push(key);
      }
    }
    keys.forEach((k) => store.removeItem(k));
  } catch {
    // Ignore
  }
}

export const authStorageAdapter = {
  getItem(key: string): string | null {
    try {
      const active = getActiveStorage();
      const value = active.getItem(key);
      if (value !== null) return value;

      // Migration: if not found in active store, check the other and migrate
      const inactive = getInactiveStorage();
      const migrated = inactive.getItem(key);
      if (migrated !== null) {
        active.setItem(key, migrated);
        inactive.removeItem(key);
      }
      return migrated;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      getActiveStorage().setItem(key, value);
      getInactiveStorage().removeItem(key);
    } catch {
      // Ignore quota errors
    }
  },

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};
