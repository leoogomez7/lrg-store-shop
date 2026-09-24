import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Archive, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listAdminBackups, type AdminBackupSummary } from "@/server/persistence";

export const Route = createFileRoute("/admin/copias")({
  loader: ({ context }) => context.queryClient.ensureQueryData(backupsQuery),
  head: () => ({ meta: [{ title: "Copias de seguridad | Administrador" }] }),
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

  const updatePageSize = () => {
    const nextSize = Number(pageSizeInput);
    if (!Number.isFinite(nextSize) || nextSize < 1) return;
    const normalizedSize = Math.min(100, Math.floor(nextSize));
    setPageSize(normalizedSize);
    setPage(0);
    setPageSizeInput(String(normalizedSize));
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Administrador</p>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {filteredBackups.length} copias · Página {safePage + 1} de {totalPages}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={safePage === 0}
            aria-label="Página anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePage >= totalPages - 1}
            aria-label="Página siguiente"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Input
            type="number"
            min={1}
            max={100}
            value={pageSizeInput}
            onChange={(event) => setPageSizeInput(event.target.value)}
            onBlur={updatePageSize}
            onKeyDown={(event) => {
              if (event.key === "Enter") updatePageSize();
            }}
            className="h-8 w-20"
            aria-label="Cantidad por página"
          />
          <span>por página</span>
        </div>
      </div>
    </main>
  );
}
