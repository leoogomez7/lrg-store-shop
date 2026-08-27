import { loadFavorites, saveFavorites } from "@/server/persistence";

const favoritesByUser = new Map<string, string[]>();

export async function hydrateFavorites(userId: string) {
  const productIds = await loadFavorites({ data: { id: userId } });
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
  return next;
}
