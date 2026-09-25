import type { Product } from "@/data/products";
import type { Order } from "@/data/orders";
import { saveAdminSetting } from "@/server/persistence";

const TRASH_STORAGE_KEY = "lrg:trash";
export const TRASH_RETENTION_DAYS = 10;
let remoteTrash: TrashEntry[] = [];

type TrashEntryBase = {
  id: string;
  deletedAt: string;
  expiresAt: string;
};

export type TrashEntry =
  | (TrashEntryBase & { type: "producto"; item: Product })
  | (TrashEntryBase & { type: "pedido"; item: Order })
  | (TrashEntryBase & {
      type: "proveedor";
      item: { name: string; phone: string; social: string };
    })
  | (TrashEntryBase & {
      type: "backup";
      item: {
        id: string;
        reason: string;
        createdAt: string;
        sizeBytes: number;
        snapshotData?: string;
      };
    });

const isExpired = (entry: TrashEntry) => new Date(entry.expiresAt).getTime() <= Date.now();

export function applyTrashEntries(entries: TrashEntry[]) {
  remoteTrash = entries.filter((entry) => !isExpired(entry));
}

export function readTrash(): TrashEntry[] {
  return remoteTrash;
}

export function moveToTrash(entry: Omit<TrashEntry, "deletedAt" | "expiresAt">) {
  if (typeof window === "undefined") return;

  const deletedAt = new Date();
  const expiresAt = new Date(deletedAt.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const nextEntry = {
    ...entry,
    deletedAt: deletedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  } as TrashEntry;
  const nextEntries = readTrash().filter(
    (current) => !(current.type === entry.type && current.id === entry.id),
  );
  remoteTrash = [nextEntry, ...nextEntries];
  void saveAdminSetting({
    data: {
      settingKey: TRASH_STORAGE_KEY,
      settingValue: JSON.stringify([nextEntry, ...nextEntries]),
    },
  });
}

export function removeFromTrash(entry: TrashEntry) {
  const nextEntries = readTrash().filter(
    (current) => !(current.type === entry.type && current.id === entry.id),
  );
  remoteTrash = nextEntries;
  void saveAdminSetting({
    data: { settingKey: TRASH_STORAGE_KEY, settingValue: JSON.stringify(nextEntries) },
  });
}

export function clearTrash() {
  remoteTrash = [];
  void saveAdminSetting({
    data: { settingKey: TRASH_STORAGE_KEY, settingValue: JSON.stringify([]) },
  });
}
