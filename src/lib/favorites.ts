const FAVORITES_STORAGE_PREFIX = "lrg:favorites:";

function getStorageKey(owner: string) {
  return `${FAVORITES_STORAGE_PREFIX}${owner || "guest"}`;
}

export function getFavoriteProductIds(owner: string) {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(getStorageKey(owner));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteProduct(owner: string, productId: string) {
  const current = getFavoriteProductIds(owner);
  const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getStorageKey(owner), JSON.stringify(next));
    window.dispatchEvent(new Event("lrg-favorites-updated"));
  }
  return next;
}
