import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Archive,
  Check,
  ContactRound,
  Package,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { orders, saveOrders } from "@/data/orders";
import { products, saveProducts } from "@/data/products";
import { applyTrashEntries, readTrash, removeFromTrash, type TrashEntry } from "@/data/trash";
import {
  deleteAdminBackupTrash,
  listAdminBackupTrash,
  loadAdminSettings,
  loadAdminTrashSetting,
  restoreAdminBackup,
  saveAdminSetting,
} from "@/server/persistence";

const SUPPLIERS_STORAGE_KEY = "lrg:suppliers";

export const Route = createFileRoute("/admin/papelera")({
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminTrash,
});

const getRemainingDays = (expiresAt: string) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

const formatBackupName = (reason: string, createdAt: string) => {
  const type =
    reason === "weekly-scheduled"
      ? "Copia semanal"
      : reason === "manual"
        ? "Copia manual"
        : "Copia por pedido";
  const date = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
  return `${type} · ${date}`;
};

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
  const [pageSizeInput, setPageSizeInput] = useState("10");
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

  const enterSelectionMode = (mode: "delete" | "restore") => {
    if (selectionMode === mode) {
      clearSelection();
      return;
    }
    const allKeys = filteredEntries.map(getEntryKey);
    setSelectionMode(mode);
    setSelectedDeleteKeys(allKeys);
    setSelectedRestoreKeys(allKeys);
  };

  const toggleAllSelection = (checked: boolean) => {
    const allKeys = filteredEntries.map(getEntryKey);
    if (!checked) {
      clearSelection();
      return;
    }
    setSelectionMode("delete");
    setSelectedDeleteKeys(checked ? allKeys : []);
    setSelectedRestoreKeys(checked ? allKeys : []);
  };

  useEffect(() => {
    let active = true;
    void Promise.all([loadAdminTrashSetting({ data: {} }), listAdminBackupTrash({ data: {} })])
      .then(([trashValue, backupEntries]) => {
        let loadedEntries: TrashEntry[] = [];
        if (trashValue) {
          try {
            loadedEntries = JSON.parse(trashValue) as TrashEntry[];
          } catch {
            loadedEntries = [];
          }
        }
        applyTrashEntries(loadedEntries);
        if (active) setEntries([...backupEntries, ...readTrash()]);
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
            : entry.type === "proveedor"
              ? entry.item.name
              : formatBackupName(entry.item.reason, entry.item.createdAt);
      const itemId = entry.type === "proveedor" ? entry.id : entry.item.id;
      return [entry.id, entry.type, name, itemId].some((value) =>
        String(value).toLowerCase().includes(normalizedQuery),
      );
    });
  }, [entries, query]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedEntries = filteredEntries.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const hasPreviousPage = safePage > 0;
  const hasNextPage = safePage < totalPages - 1;

  useEffect(() => {
    setPageSizeInput(String(pageSize));
  }, [pageSize]);

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
    } else if (entry.type === "proveedor") {
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
    } else {
      await restoreAdminBackup({ data: { backup: entry.item } });
    }
    if (entry.type !== "backup") removeFromTrash(entry);
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

    if (entryToDelete.type === "backup") {
      void deleteAdminBackupTrash({ data: { id: entryToDelete.id } });
    } else {
      removeFromTrash(entryToDelete);
    }
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
    const selectedEntries = entries.filter((entry) =>
      selectedDeleteKeys.includes(getEntryKey(entry)),
    );
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
      if (entry.type === "backup") {
        void deleteAdminBackupTrash({ data: { id: entry.id } });
      } else {
        removeFromTrash(entry);
      }
    });

    setEntries((current) =>
      current.filter((entry) => !selectedDeleteKeys.includes(getEntryKey(entry))),
    );
    clearSelection();
  };

  const restoreSelectedEntries = async () => {
    const selectedEntries = entries.filter((entry) =>
      selectedRestoreKeys.includes(getEntryKey(entry)),
    );
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
          if (entry.type === "backup") {
            void deleteAdminBackupTrash({ data: { id: entry.id } });
          } else {
            removeFromTrash(entry);
          }
        });

        setEntries([]);
        clearSelection();
      },
    });
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Eliminaciones</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold">Papelera</h1>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar elemento eliminado"
            aria-label="Buscar elemento eliminado"
            className="h-10 w-full rounded-xl border border-input bg-background/80 pl-9 pr-3 text-sm outline-none transition focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={emptyTrash}>
            <Trash2 className="size-4" /> Vaciar papelera
          </Button>
          <Button type="button" variant="outline" onClick={restoreAllEntries}>
            <RotateCcw className="size-4" /> Restaurar todos
          </Button>
        </div>
      </div>

      <div className="mt-5 glass-panel w-full overflow-hidden rounded-2xl border border-border/60">
        <Table
          hideScrollbarOnMobile
          hideScrollbar
          containerClassName="overflow-x-hidden overflow-y-visible"
          className="w-full min-w-0 table-fixed text-center text-sm [&_td]:align-middle [&_th]:align-middle [&_td]:py-3 [&_th]:py-3 [&_td]:text-center [&_th]:text-center"
        >
          <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead className="w-12 min-w-12 max-w-12 px-2 text-center">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={
                      filteredEntries.length > 0 &&
                      filteredEntries.every((entry) =>
                        selectedDeleteKeys.includes(getEntryKey(entry)),
                      )
                        ? true
                        : filteredEntries.some((entry) =>
                              selectedDeleteKeys.includes(getEntryKey(entry)),
                            )
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) => toggleAllSelection(checked === true)}
                    aria-label="Seleccionar elementos visibles"
                  />
                </div>
              </TableHead>
              <TableHead className="w-14 text-center">Icono</TableHead>
              <TableHead className="w-64">Nombre</TableHead>
              <TableHead className="w-24 min-w-24 max-w-24">Tipo</TableHead>
              <TableHead className="w-28 min-w-28 max-w-28">Eliminación en</TableHead>
              <TableHead className="w-52 min-w-52 max-w-52">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  Cargando elementos eliminados...
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  La papelera está vacía.
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No se encontraron elementos eliminados.
                </TableCell>
              </TableRow>
            ) : (
              paginatedEntries.map((entry) => {
                const isProduct = entry.type === "producto";
                const isOrder = entry.type === "pedido";
                const isBackup = entry.type === "backup";
                const name = isProduct
                  ? entry.item.name
                  : isOrder
                    ? `${entry.item.id} · ${entry.item.customer}`
                    : entry.type === "proveedor"
                      ? entry.item.name
                      : formatBackupName(entry.item.reason, entry.item.createdAt);
                return (
                  <TableRow key={`${entry.type}-${entry.id}`}>
                    <TableCell className="w-12 min-w-12 max-w-12 px-2 text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={
                            selectionMode === "restore"
                              ? selectedRestoreKeys.includes(getEntryKey(entry))
                              : selectedDeleteKeys.includes(getEntryKey(entry))
                          }
                          onCheckedChange={(checked) => {
                            const entryKey = getEntryKey(entry);
                            setSelectionMode("delete");
                            const updateSelection = (current: string[]) =>
                              checked === true
                                ? [...new Set([...current, entryKey])]
                                : current.filter((key) => key !== entryKey);
                            setSelectedDeleteKeys(updateSelection);
                            setSelectedRestoreKeys(updateSelection);
                          }}
                          aria-label={`Seleccionar ${name}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="w-14 text-center">
                      <span className="mx-auto grid size-9 place-items-center rounded-lg bg-surface-2">
                        {isProduct ? (
                          <Package className="size-4" />
                        ) : isOrder ? (
                          <ShoppingCart className="size-4" />
                        ) : isBackup ? (
                          <Archive className="size-4" />
                        ) : (
                          <ContactRound className="size-4" />
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="w-64 max-w-64 truncate font-medium">{name}</TableCell>
                    <TableCell className="w-24 min-w-24 max-w-24">
                      {isProduct
                        ? "Producto"
                        : isOrder
                          ? "Pedido"
                          : isBackup
                            ? "Copia de seguridad"
                            : "Proveedor"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {getRemainingDays(entry.expiresAt)} días
                    </TableCell>
                    <TableCell className="w-52">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          className="shrink-0"
                          size="sm"
                          variant="outline"
                          onClick={() => restoreEntry(entry)}
                        >
                          <RotateCcw className="size-4" /> Restaurar
                        </Button>
                        <Button
                          className="shrink-0"
                          size="sm"
                          variant="destructive"
                          onClick={() => setEntryToDelete(entry)}
                        >
                          <Trash2 className="size-4" /> Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectionMode && (selectedDeleteKeys.length > 0 || selectedRestoreKeys.length > 0) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="default" size="sm" onClick={restoreSelectedEntries}>
            <RotateCcw className="size-4" /> Restaurar seleccionados
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={deleteSelectedPermanently}>
            <Trash2 className="size-4" /> Eliminar seleccionados
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        Los elementos se eliminan automáticamente después de 10 días.
      </p>

      {!isLoading && filteredEntries.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3 pb-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPage(0)}
              disabled={!hasPreviousPage}
              className="h-9 px-4"
            >
              Principio
            </Button>
            <div className="flex items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`h-9 min-w-9 rounded-xl border border-input px-3 py-1.5 text-sm outline-none transition-colors focus-visible:outline-none ${
                    index === safePage
                      ? "bg-muted text-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-surface-2"
                  }`}
                  onClick={() => setPage(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPage(totalPages - 1)}
              disabled={!hasNextPage}
              className="h-9 px-4"
            >
              Último
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="text-sm text-muted-foreground">Mostrar</div>
            <Input
              type="number"
              min={1}
              max={1000}
              value={pageSizeInput}
              placeholder="Cantidad"
              onChange={(event) => setPageSizeInput(event.target.value)}
              className="h-8 w-20 bg-background/50"
            />

            {(() => {
              const v = Number(pageSizeInput);
              const isValid = Number.isFinite(v) && v >= 1;
              const isChanged = pageSizeInput !== "" && String(Math.floor(v)) !== String(pageSize);
              return (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!isValid || !isChanged) return;
                    const final = Math.min(1000, Math.floor(v));
                    setPageSize(final);
                    setPage(0);
                  }}
                  disabled={!isValid || !isChanged}
                  className="h-8 px-4"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar
                </Button>
              );
            })()}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {paginatedEntries.length} de {filteredEntries.length} elementos mostrados
          </p>
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
        confirmLabel={
          entryToDelete !== null ? "Eliminar definitivamente" : confirmState.confirmLabel
        }
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
