import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ContactRound, Package, RotateCcw, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { orders, saveOrders } from "@/data/orders";
import { products, saveProducts } from "@/data/products";
import { applyTrashEntries, readTrash, removeFromTrash, type TrashEntry } from "@/data/trash";
import { loadAdminSettings, saveAdminSetting } from "@/server/persistence";

const SUPPLIERS_STORAGE_KEY = "lrg:suppliers";

export const Route = createFileRoute("/admin/papelera")({
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminTrash,
});

const getRemainingDays = (expiresAt: string) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

function AdminTrash() {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<TrashEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entryToDelete, setEntryToDelete] = useState<TrashEntry | null>(null);
  const [query, setQuery] = useState("");
  const [selectionMode, setSelectionMode] = useState<"delete" | "restore" | null>(null);
  const [selectedDeleteKeys, setSelectedDeleteKeys] = useState<string[]>([]);
  const [selectedRestoreKeys, setSelectedRestoreKeys] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    onConfirm: () => {},
  });

  const getEntryKey = (entry: TrashEntry) => `${entry.type}-${entry.id}`;

  const clearSelection = () => {
    setSelectionMode(null);
    setSelectedDeleteKeys([]);
    setSelectedRestoreKeys([]);
  };

  useEffect(() => {
    let active = true;
    void loadAdminSettings({ data: {} })
      .then((settings) => {
        const trashSetting = settings.find((setting) => setting.settingKey === "lrg:trash");
        let loadedEntries: TrashEntry[] = [];
        if (trashSetting) {
          try {
            loadedEntries = JSON.parse(trashSetting.settingValue) as TrashEntry[];
          } catch {
            loadedEntries = [];
          }
        }
        applyTrashEntries(loadedEntries);
        if (active) setEntries(readTrash());
      })
      .catch(() => {
        if (active) setEntries([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return entries;
    return entries.filter((entry) => {
      const name =
        entry.type === "producto"
          ? entry.item.name
          : entry.type === "pedido"
            ? entry.item.customer
            : entry.item.name;
      const itemId = entry.type === "proveedor" ? entry.id : entry.item.id;
      return [entry.id, entry.type, name, itemId].some((value) =>
        String(value).toLowerCase().includes(normalizedQuery),
      );
    });
  }, [entries, query]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedEntries = filteredEntries.slice(safePage * pageSize, (safePage + 1) * pageSize);

  useEffect(() => {
    setPage(0);
  }, [query, pageSize]);

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  const restoreEntry = async (entry: TrashEntry) => {
    if (entry.type === "producto") {
      if (products.some((product) => product.id === entry.item.id)) return;
      products.push(entry.item);
      saveProducts(products);
    } else if (entry.type === "pedido") {
      if (!orders.some((order) => order.id === entry.item.id)) {
        orders.push(entry.item);
        saveOrders(orders);
      }
    } else {
      const settings = await loadAdminSettings({ data: {} });
      const setting = settings.find((item) => item.settingKey === SUPPLIERS_STORAGE_KEY);
      let suppliers: Array<{ name: string; phone: string; social: string }> = [];
      if (setting) {
        try {
          const parsed = JSON.parse(setting.settingValue) as unknown;
          suppliers = Array.isArray(parsed) ? parsed : [];
        } catch {
          suppliers = [];
        }
      }
      const exists = suppliers.some(
        (supplier) =>
          supplier.name === entry.item.name &&
          supplier.phone === entry.item.phone &&
          supplier.social === entry.item.social,
      );
      if (!exists) {
        await saveAdminSetting({
          data: {
            settingKey: SUPPLIERS_STORAGE_KEY,
            settingValue: JSON.stringify([...suppliers, entry.item]),
          },
        });
      }
    }
    removeFromTrash(entry);
    void queryClient.invalidateQueries({
      queryKey:
        entry.type === "producto"
          ? ["products"]
          : entry.type === "pedido"
            ? ["orders"]
            : ["admin-settings"],
    });
    setEntries((current) =>
      current.filter((item) => item.id !== entry.id || item.type !== entry.type),
    );
  };

  const deletePermanently = () => {
    if (!entryToDelete) return;

    if (entryToDelete.type === "producto") {
      const productIndex = products.findIndex((product) => product.id === entryToDelete.item.id);
      if (productIndex >= 0) {
        products.splice(productIndex, 1);
        saveProducts(products);
      }
    } else if (entryToDelete.type === "pedido") {
      const orderIndex = orders.findIndex((order) => order.id === entryToDelete.item.id);
      if (orderIndex >= 0) {
        orders.splice(orderIndex, 1);
        saveOrders(orders);
      }
    }

    removeFromTrash(entryToDelete);
    void queryClient.invalidateQueries({
      queryKey:
        entryToDelete.type === "producto"
          ? ["products"]
          : entryToDelete.type === "pedido"
            ? ["orders"]
            : ["admin-settings"],
    });
    setEntries((current) =>
      current.filter((item) => item.id !== entryToDelete.id || item.type !== entryToDelete.type),
    );
    setEntryToDelete(null);
  };

  const deleteSelectedPermanently = () => {
    const selectedEntries = entries.filter((entry) => selectedDeleteKeys.includes(getEntryKey(entry)));
    if (!selectedEntries.length) return;

    selectedEntries.forEach((entry) => {
      if (entry.type === "producto") {
        const productIndex = products.findIndex((product) => product.id === entry.item.id);
        if (productIndex >= 0) {
          products.splice(productIndex, 1);
          saveProducts(products);
        }
      } else if (entry.type === "pedido") {
        const orderIndex = orders.findIndex((order) => order.id === entry.item.id);
        if (orderIndex >= 0) {
          orders.splice(orderIndex, 1);
          saveOrders(orders);
        }
      }
      removeFromTrash(entry);
    });

    setEntries((current) =>
      current.filter((entry) => !selectedDeleteKeys.includes(getEntryKey(entry))),
    );
    clearSelection();
  };

  const restoreSelectedEntries = async () => {
    const selectedEntries = entries.filter((entry) => selectedRestoreKeys.includes(getEntryKey(entry)));
    if (!selectedEntries.length) return;

    for (const entry of selectedEntries) {
      await restoreEntry(entry);
    }
    clearSelection();
  };

  const restoreAllEntries = () => {
    if (!entries.length) return;
    setConfirmState({
      open: true,
      title: "¿Restaurar todos los elementos?",
      description: "Se restaurarán todos los elementos de la papelera.",
      confirmLabel: "Restaurar todo",
      onConfirm: async () => {
        for (const entry of [...entries]) {
          await restoreEntry(entry);
        }
        clearSelection();
      },
    });
  };

  const emptyTrash = () => {
    if (!entries.length) return;
    setConfirmState({
      open: true,
      title: "¿Vaciar la papelera?",
      description: "Esta acción elimina definitivamente todos los elementos de la papelera.",
      confirmLabel: "Vaciar papelera",
      onConfirm: () => {
        entries.forEach((entry) => {
          if (entry.type === "producto") {
            const productIndex = products.findIndex((product) => product.id === entry.item.id);
            if (productIndex >= 0) {
              products.splice(productIndex, 1);
              saveProducts(products);
            }
          } else if (entry.type === "pedido") {
            const orderIndex = orders.findIndex((order) => order.id === entry.item.id);
            if (orderIndex >= 0) {
              orders.splice(orderIndex, 1);
              saveOrders(orders);
            }
          }
          removeFromTrash(entry);
        });

        setEntries([]);
        clearSelection();
      },
    });
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Eliminaciones</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold">Papelera</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Los elementos se eliminan automáticamente después de 10 días.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={emptyTrash}>
          <Trash2 className="size-4" /> Vaciar papelera
        </Button>
        <Button type="button" variant="outline" onClick={restoreAllEntries}>
          <RotateCcw className="size-4" /> Restaurar todos
        </Button>
        <Button
          type="button"
          variant={selectionMode === "delete" ? "default" : "outline"}
          onClick={() => {
            setSelectionMode((current) => (current === "delete" ? null : "delete"));
            setSelectedRestoreKeys([]);
          }}
        >
          <Trash2 className="size-4" /> Seleccionar borrados
        </Button>
        <Button
          type="button"
          variant={selectionMode === "restore" ? "default" : "outline"}
          onClick={() => {
            setSelectionMode((current) => (current === "restore" ? null : "restore"));
            setSelectedDeleteKeys([]);
          }}
        >
          <RotateCcw className="size-4" /> Seleccionar restaurar
        </Button>
        {selectionMode ? (
          <Button type="button" variant="ghost" onClick={clearSelection}>
            <X className="size-4" /> Cancelar
          </Button>
        ) : null}
      </div>

      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar elemento eliminado"
          aria-label="Buscar elemento eliminado"
          className="h-10 w-full rounded-xl border border-input bg-background/80 pl-9 pr-3 text-sm outline-none transition focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{entries.length} elementos</span>
        <div className="flex min-h-10 items-center justify-end gap-2">
          {selectionMode === "delete" && selectedDeleteKeys.length > 0 ? (
            <Button type="button" variant="destructive" onClick={deleteSelectedPermanently}>
              <Trash2 className="size-4" /> Eliminar seleccionados
            </Button>
          ) : null}
          {selectionMode === "restore" && selectedRestoreKeys.length > 0 ? (
            <Button type="button" variant="default" onClick={restoreSelectedEntries}>
              <RotateCcw className="size-4" /> Restaurar seleccionados
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 space-y-3 pb-20">
        {isLoading ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            Cargando elementos eliminados...
          </div>
        ) : entries.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            La papelera está vacía.
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No se encontraron elementos eliminados.
          </div>
        ) : (
          paginatedEntries.map((entry) => {
            const isProduct = entry.type === "producto";
            const isOrder = entry.type === "pedido";
            const name = isProduct
              ? entry.item.name
              : isOrder
                ? `${entry.item.id} · ${entry.item.customer}`
                : entry.item.name;
            return (
              <div
                key={`${entry.type}-${entry.id}`}
                className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {selectionMode ? (
                    <input
                      type="checkbox"
                      checked={
                        selectionMode === "delete"
                          ? selectedDeleteKeys.includes(getEntryKey(entry))
                          : selectedRestoreKeys.includes(getEntryKey(entry))
                      }
                      onChange={(event) => {
                        const checked = event.target.checked;
                        const entryKey = getEntryKey(entry);
                        if (selectionMode === "delete") {
                          setSelectedDeleteKeys((current) => {
                            const next = checked
                              ? [...new Set([...current, entryKey])]
                              : current.filter((key) => key !== entryKey);
                            return next;
                          });
                          return;
                        }
                        setSelectedRestoreKeys((current) => {
                          const next = checked
                            ? [...new Set([...current, entryKey])]
                            : current.filter((key) => key !== entryKey);
                          return next;
                        });
                      }}
                      className="h-4 w-4 accent-primary"
                      aria-label={`Seleccionar ${name}`}
                    />
                  ) : null}
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2">
                    {isProduct ? (
                      <Package className="size-4" />
                    ) : isOrder ? (
                      <ShoppingCart className="size-4" />
                    ) : (
                      <ContactRound className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isProduct ? "Producto" : isOrder ? "Pedido" : "Proveedor"} · Se elimina en{" "}
                      {getRemainingDays(entry.expiresAt)} días
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => restoreEntry(entry)}>
                    <RotateCcw className="size-4" /> Restaurar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setEntryToDelete(entry)}>
                    <Trash2 className="size-4" /> Eliminar
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!isLoading && filteredEntries.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Mostrar</span>
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-10 rounded-xl border border-input bg-background/80 px-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Cantidad de elementos por página"
            >
              {[10, 20, 30, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage(0)} disabled={safePage === 0}>
              Principio
            </Button>
            <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-sm font-medium text-foreground">
              {safePage + 1}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage(totalPages - 1)}
              disabled={safePage >= totalPages - 1}
            >
              Último
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmState.open || entryToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmState((current) => ({ ...current, open: false }));
            setEntryToDelete(null);
          }
        }}
        title={entryToDelete !== null ? "¿Eliminar definitivamente?" : confirmState.title}
        description={
          entryToDelete !== null
            ? "Este elemento no podrá restaurarse después."
            : confirmState.description
        }
        confirmLabel={entryToDelete !== null ? "Eliminar definitivamente" : confirmState.confirmLabel}
        cancelLabel="Cancelar"
        onConfirm={() => {
          if (entryToDelete) {
            deletePermanently();
            return;
          }
          confirmState.onConfirm();
          setConfirmState((current) => ({ ...current, open: false }));
        }}
      />
    </main>
  );
}
