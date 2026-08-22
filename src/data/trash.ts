import type { Product } from "@/data/products";
import type { Order } from "@/data/orders";

const TRASH_STORAGE_KEY = "lrg:trash";
export const TRASH_RETENTION_DAYS = 10;

type TrashEntryBase = {
  id: string;
  deletedAt: string;
  expiresAt: string;
};

export type TrashEntry =
  | (TrashEntryBase & { type: "producto"; item: Product })
  | (TrashEntryBase & { type: "pedido"; item: Order });

const isExpired = (entry: TrashEntry) => new Date(entry.expiresAt).getTime() <= Date.now();

export function readTrash(): TrashEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(TRASH_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as TrashEntry[]) : [];
    const activeEntries = Array.isArray(parsed) ? parsed.filter((entry) => !isExpired(entry)) : [];
    if (activeEntries.length !== parsed.length) {
      window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(activeEntries));
    }
    return activeEntries;
  } catch {
    return [];
  }
}

export function moveToTrash(entry: Omit<TrashEntry, "deletedAt" | "expiresAt">) {
  if (typeof window === "undefined") return;

  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const nextEntry = { ...entry, deletedAt: deletedAt.toISOString(), expiresAt: expiresAt.toISOString() } as TrashEntry;
  const nextEntries = readTrash().filter((current) => !(current.type === entry.type && current.id === entry.id));
  window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify([nextEntry, ...nextEntries]));
}

export function removeFromTrash(entry: TrashEntry) {
  const nextEntries = readTrash().filter((current) => !(current.type === entry.type && current.id === entry.id));
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(nextEntries));
  }
}
