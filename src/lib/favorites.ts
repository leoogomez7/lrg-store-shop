import { loadFavorites, saveFavorites } from "@/server/persistence";

const favoritesByUser = new Map<string, string[]>();
const favoriteVersions = new Map<string, number>();
const favoriteListeners = new Map<string, Set<(productIds: string[]) => void>>();
const favoriteSyncKey = "lrg-favorites-sync";
let favoriteChannel: BroadcastChannel | null = null;
let syncInitialized = false;

function notifyFavoriteListeners(userId: string, productIds: string[]) {
  favoriteListeners.get(userId)?.forEach((listener) => listener(productIds));
}

function applySynchronizedFavorites(userId: string, productIds: string[]) {
  favoriteVersions.set(userId, (favoriteVersions.get(userId) ?? 0) + 1);
  favoritesByUser.set(userId, productIds);
  notifyFavoriteListeners(userId, productIds);
}

function initializeFavoriteSync() {
  if (syncInitialized || typeof window === "undefined") return;
  syncInitialized = true;

  if ("BroadcastChannel" in window) {
    favoriteChannel = new BroadcastChannel(favoriteSyncKey);
    favoriteChannel.addEventListener("message", (event: MessageEvent<{ userId?: string; productIds?: string[] }>) => {
      if (!event.data?.userId || !Array.isArray(event.data.productIds)) return;
      applySynchronizedFavorites(event.data.userId, event.data.productIds);
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== favoriteSyncKey || !event.newValue) return;
    try {
      const data = JSON.parse(event.newValue) as { userId?: string; productIds?: string[] };
      if (!data.userId || !Array.isArray(data.productIds)) return;
      applySynchronizedFavorites(data.userId, data.productIds);
    } catch {
      return;
    }
  });
}

function publishFavoriteChange(userId: string, productIds: string[]) {
  initializeFavoriteSync();
  favoriteVersions.set(userId, (favoriteVersions.get(userId) ?? 0) + 1);
  const data = { userId, productIds };
  favoriteChannel?.postMessage(data);
  window.localStorage.setItem(favoriteSyncKey, JSON.stringify({ ...data, timestamp: Date.now() }));
  notifyFavoriteListeners(userId, productIds);
}

export function subscribeToFavoriteChanges(
  userId: string,
  listener: (productIds: string[]) => void,
) {
  initializeFavoriteSync();
  const listeners = favoriteListeners.get(userId) ?? new Set();
  listeners.add(listener);
  favoriteListeners.set(userId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) favoriteListeners.delete(userId);
  };
}

export async function hydrateFavorites(userId: string) {
  const versionAtRequest = favoriteVersions.get(userId) ?? 0;
  const productIds = await loadFavorites({ data: { id: userId } });

  // Do not overwrite a newer change received while the database request was pending.
  if ((favoriteVersions.get(userId) ?? 0) !== versionAtRequest) {
    return getFavoriteProductIds(userId);
  }

  favoritesByUser.set(userId, productIds);
  return productIds;
}

export function getFavoriteProductIds(owner: string) {
  return favoritesByUser.get(owner) ?? [];
}

export function toggleFavoriteProduct(owner: string, productId: string) {
  const current = getFavoriteProductIds(owner);
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [...current, productId];
  favoritesByUser.set(owner, next);
  void saveFavorites({ data: { id: owner, productIds: next } });
  publishFavoriteChange(owner, next);
  return next;
}
