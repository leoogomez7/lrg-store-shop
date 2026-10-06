export const STOCK_RESERVATION_TTL_MS = 5 * 60 * 1000;

export type ReservationState =
  | "reserved"
  | "waiting"
  | "available"
  | "expired"
  | "sold"
  | "unavailable"
  | "unlimited";

export type ReservationRecord = {
  ownerId: string;
  visitId: string;
  quantity: number;
  expiresAt: string;
};

export function getInventoryKey(productId: string, variantId?: string) {
  return variantId ? `${productId}::${variantId}` : productId;
}

export function splitInventoryKey(inventoryKey: string) {
  const separator = inventoryKey.indexOf("::");
  return separator < 0
    ? { productId: inventoryKey, variantId: undefined }
    : {
        productId: inventoryKey.slice(0, separator),
        variantId: inventoryKey.slice(separator + 2) || undefined,
      };
}

export function assessStockReservation({
  stock,
  stockUnlimited,
  ownerId,
  visitId,
  requestedQuantity,
  records,
  now,
}: {
  stock: number;
  stockUnlimited: boolean;
  ownerId: string;
  visitId: string;
  requestedQuantity: number;
  records: ReservationRecord[];
  now: number;
}): { state: ReservationState; expiresAt?: string; availableQuantity: number } {
  if (stockUnlimited) return { state: "unlimited", availableQuantity: Number.POSITIVE_INFINITY };
  if (!Number.isFinite(stock) || stock <= 0) return { state: "sold", availableQuantity: 0 };
  if (!Number.isInteger(requestedQuantity) || requestedQuantity < 1) {
    return { state: "unavailable", availableQuantity: 0 };
  }
  if (requestedQuantity > stock) return { state: "unavailable", availableQuantity: stock };

  const active = records.filter((record) => new Date(record.expiresAt).getTime() > now);
  const ownActive = active.find((record) => record.ownerId === ownerId);
  const otherActive = active.filter((record) => record.ownerId !== ownerId);
  const reservedByOthers = otherActive.reduce((sum, record) => sum + record.quantity, 0);
  const availableQuantity = Math.max(0, stock - reservedByOthers);
  const nextExpiry = otherActive
    .map((record) => record.expiresAt)
    .sort((first, second) => first.localeCompare(second))[0];

  if (availableQuantity >= requestedQuantity) {
    if (ownActive) return { state: "reserved", expiresAt: ownActive.expiresAt, availableQuantity };
    const ownExpired = records.find((record) => record.ownerId === ownerId);
    if (ownExpired) {
      return { state: "expired", expiresAt: ownExpired.expiresAt, availableQuantity };
    }
    return { state: "available", availableQuantity };
  }

  const expiresAt = nextExpiry ?? ownActive?.expiresAt;
  if (expiresAt) return { state: "waiting", expiresAt, availableQuantity };

  const ownExpired = records.find((record) => record.ownerId === ownerId);
  if (ownExpired) {
    return { state: "expired", expiresAt: ownExpired.expiresAt, availableQuantity };
  }
  return { state: "available", availableQuantity };
}

export function formatReservationCountdown(expiresAt: string, now: number) {
  const remainingMs = Math.max(0, new Date(expiresAt).getTime() - now);
  const seconds = Math.ceil(remainingMs / 1000);
  const minutesText = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secondsText = String(seconds % 60).padStart(2, "0");
  return `${minutesText}:${secondsText}`;
}
