function getStorageValue(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

export function getStoredUserDisplayName(): string | null {
  return (
    getStorageValue('userFullName') ||
    getStorageValue('fullName') ||
    getStorageValue('name') ||
    getStorageValue('userName')
  );
}

export function getStoredActivePanel(): string | null {
  return getStorageValue('activePanel');
}

export async function logout(): Promise<void> {
  try {
    // Attempt server-side logout (best-effort)
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    // ignore network errors — continue clearing client state
  }

  try {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
  } catch (e) {
    // ignore
  }
}
