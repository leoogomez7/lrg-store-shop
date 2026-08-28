import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Package, RotateCcw, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { orders, saveOrders } from "@/data/orders";
import { products, saveProducts } from "@/data/products";
import { readTrash, removeFromTrash, type TrashEntry } from "@/data/trash";

export const Route = createFileRoute("/admin/papelera")({
  head: () => ({ meta: [{ title: "LRG Store Shop - Papelera" }] }),
  component: AdminTrash,
});

const getRemainingDays = (expiresAt: string) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

function AdminTrash() {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<TrashEntry[]>(() => readTrash());
  const [entryToDelete, setEntryToDelete] = useState<TrashEntry | null>(null);
  const [query, setQuery] = useState("");

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return entries;
    return entries.filter((entry) => {
      const name = entry.type === "producto" ? entry.item.name : entry.item.customer;
      return [entry.id, entry.type, name, entry.item.id].some((value) =>
        String(value).toLowerCase().includes(normalizedQuery),
      );
    });
  }, [entries, query]);

  const restoreEntry = (entry: TrashEntry) => {
    if (entry.type === "producto") {
      if (products.some((product) => product.id === entry.item.id)) return;
      products.push(entry.item);
      saveProducts(products);
    } else {
      if (!orders.some((order) => order.id === entry.item.id)) {
        orders.push(entry.item);
        saveOrders(orders);
      }
    }
    removeFromTrash(entry);
    void queryClient.invalidateQueries({
      queryKey: entry.type === "producto" ? ["products"] : ["orders"],
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
    } else {
      const orderIndex = orders.findIndex((order) => order.id === entryToDelete.item.id);
      if (orderIndex >= 0) {
        orders.splice(orderIndex, 1);
        saveOrders(orders);
      }
    }

    removeFromTrash(entryToDelete);
    void queryClient.invalidateQueries({
      queryKey: entryToDelete.type === "producto" ? ["products"] : ["orders"],
    });
    setEntries((current) =>
      current.filter((item) => item.id !== entryToDelete.id || item.type !== entryToDelete.type),
    );
    setEntryToDelete(null);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Eliminaciones</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold">Papelera</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Los elementos se eliminan automáticamente después de 10 días.
          </p>
        </div>
        <span className="text-sm text-muted-foreground">{entries.length} elementos</span>
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

      <div className="mt-6 space-y-3 pb-20">
        {entries.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            La papelera está vacía.
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No se encontraron elementos eliminados.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isProduct = entry.type === "producto";
            const name = isProduct ? entry.item.name : `${entry.item.id} · ${entry.item.customer}`;
            return (
              <div
                key={`${entry.type}-${entry.id}`}
                className="glass-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2">
                    {isProduct ? (
                      <Package className="size-4" />
                    ) : (
                      <ShoppingCart className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isProduct ? "Producto" : "Pedido"} · Se elimina en{" "}
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

      <ConfirmDialog
        open={entryToDelete !== null}
        onOpenChange={(open) => !open && setEntryToDelete(null)}
        title="¿Eliminar definitivamente?"
        description="Este elemento no podrá restaurarse después."
        confirmLabel="Eliminar definitivamente"
        cancelLabel="Cancelar"
        onConfirm={deletePermanently}
      />
    </main>
  );
}
