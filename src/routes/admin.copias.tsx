import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Archive, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/common/loading-state";
import { listAdminBackups, type AdminBackupSummary } from "@/server/persistence";

export const Route = createFileRoute("/admin/copias")({
  loader: ({ context }) => context.queryClient.ensureQueryData(backupsQuery),
  pendingComponent: () => <LoadingState label="Cargando copias de seguridad..." />,
  head: () => ({ meta: [{ title: "Copias de seguridad | Respaldo" }] }),
  component: AdminBackups,
});

const backupsQuery = {
  queryKey: ["admin-backups"],
  queryFn: () => listAdminBackups({ data: {} }),
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

function AdminBackups() {
  const { data: backups } = useSuspenseQuery(backupsQuery);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeInput, setPageSizeInput] = useState("10");

  const filteredBackups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return backups;
    return backups.filter((backup) =>
      [backup.id, backup.reason, backup.createdAt].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [backups, query]);

  const totalPages = Math.max(1, Math.ceil(filteredBackups.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleBackups = filteredBackups.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const hasPreviousPage = safePage > 0;
  const hasNextPage = safePage < totalPages - 1;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Respaldo</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Copias de seguridad</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshots automáticos creados al registrar compras.
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Buscar copia"
            className="pl-9"
          />
        </div>
      </div>

      <div className="glass-panel overflow-hidden rounded-2xl border border-border/60">
        <div className="hidden grid-cols-[1.4fr_1fr_1fr_0.7fr] gap-4 border-b border-border/60 bg-surface-2 px-5 py-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground md:grid">
          <span>Fecha</span>
          <span>Pedido</span>
          <span>Motivo</span>
          <span>Tamaño</span>
        </div>
        <div className="divide-y divide-border/60">
          {visibleBackups.length > 0 ? (
            visibleBackups.map((backup: AdminBackupSummary) => (
              <div
                key={backup.id}
                className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[1.4fr_1fr_1fr_0.7fr] md:items-center md:gap-4"
              >
                <div className="flex items-center gap-2">
                  <Archive className="size-4 shrink-0 text-primary" />
                  <span>{formatDate(backup.createdAt)}</span>
                </div>
                <span className="break-all text-muted-foreground">{backup.id.split(":")[0]}</span>
                <span className="text-muted-foreground">{backup.reason}</span>
                <span className="text-muted-foreground">{formatBytes(backup.sizeBytes)}</span>
              </div>
            ))
          ) : (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No hay copias de seguridad registradas.
            </div>
          )}
        </div>
      </div>

      {filteredBackups.length > 0 ? (
        <div className="mt-2 flex flex-col gap-3 pb-20">
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
              const value = Number(pageSizeInput);
              const isValid = Number.isFinite(value) && value >= 1;
              const isChanged =
                pageSizeInput !== "" && String(Math.floor(value)) !== String(pageSize);
              return (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!isValid || !isChanged) return;
                    const final = Math.min(1000, Math.floor(value));
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
            {visibleBackups.length} de {filteredBackups.length} elementos mostrados
          </p>
        </div>
      ) : null}
    </main>
  );
}
