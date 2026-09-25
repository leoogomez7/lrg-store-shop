import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Download, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/common/loading-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createAdminBackup,
  deleteAdminBackup,
  loadAdminBackup,
  listAdminBackups,
  type AdminBackupSummary,
} from "@/server/persistence";

export const Route = createFileRoute("/admin/copias")({
  loader: ({ context }) => context.queryClient.ensureQueryData(backupsQuery),
  pendingComponent: () => <LoadingState label="Cargando copias de seguridad..." />,
  head: () => ({ meta: [{ title: "Administrador" }] }),
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

const getBackupReference = (backup: AdminBackupSummary) => {
  if (backup.reason === "weekly-scheduled") return "Copia todos los lunes 0:00 hs";
  if (backup.reason === "manual") return "Copia creada por el administrador";
  return `Pedido ${backup.id.split(":")[0]}`;
};

const getBackupType = (backup: AdminBackupSummary) => {
  if (backup.reason === "weekly-scheduled") return "Copia semanal";
  if (backup.reason === "manual") return "Copia manual";
  return "Copia por pedido";
};

const getNextWeeklyBackup = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  const current = new Date(
    Date.UTC(Number(parts["year"]), Number(parts["month"]) - 1, Number(parts["day"])),
  );
  const daysUntilMonday = ((8 - current.getUTCDay()) % 7) || 7;
  current.setUTCDate(current.getUTCDate() + daysUntilMonday);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(`${current.toISOString().slice(0, 10)}T00:00:00-03:00`));
};

function AdminBackups() {
  const queryClient = useQueryClient();
  const { data: backups } = useSuspenseQuery(backupsQuery);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<AdminBackupSummary | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeInput, setPageSizeInput] = useState("10");

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const created = await createAdminBackup({ data: { reason: "manual" } });
      if (created) {
        await queryClient.invalidateQueries({ queryKey: backupsQuery.queryKey });
        toast.success("Copia de seguridad creada");
      } else {
        toast.error("No se pudo crear la copia de seguridad");
      }
    } catch {
      toast.error("No se pudo crear la copia de seguridad");
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const downloadBackup = async (backup: AdminBackupSummary) => {
    try {
      const detail = await loadAdminBackup({ data: { id: backup.id } });
      if (!detail) {
        toast.error("No se pudo cargar la copia de seguridad");
        return;
      }
      const blob = new Blob([detail.snapshotData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `copia-seguridad-${detail.createdAt.replace(/[:.]/g, "-")}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("No se pudo descargar la copia de seguridad");
    }
  };

  const moveBackupToTrash = async (backup: AdminBackupSummary) => {
    const deleted = await deleteAdminBackup({ data: { id: backup.id } });
    if (!deleted) {
      toast.error("No se pudo enviar la copia a la papelera");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: backupsQuery.queryKey });
    setBackupToDelete(null);
    toast.success("Copia enviada a la papelera");
  };

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
          <p className="mt-1 text-sm text-muted-foreground">Copias semanales, manuales y por pedido.</p>
          <p className="mt-2 text-sm text-primary">
            La próxima copia de seguridad semanal es el {getNextWeeklyBackup()}.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-64">
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
          <Button
            type="button"
            variant="outline"
            disabled={isCreatingBackup}
            onClick={() => void handleCreateBackup()}
            className="min-w-44 whitespace-nowrap"
          >
            {isCreatingBackup ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {isCreatingBackup ? "Creando copia" : "Crear copia manual"}
          </Button>
        </div>
      </div>

      <div className="glass-panel mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-border/60">
        <div className="hidden grid-cols-[1.1fr_1.2fr_2fr_1.1fr] gap-4 border-b border-border/60 bg-surface-2 px-5 py-3 text-center text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground md:grid">
          <span>Fecha</span>
          <span>Tipo de copias</span>
          <span>Referencia</span>
          <span>Tamaño</span>
        </div>
        <div className="divide-y divide-border/60">
          {visibleBackups.length > 0 ? (
            visibleBackups.map((backup: AdminBackupSummary) => (
              <div
                key={backup.id}
                className="grid gap-2 px-5 py-4 text-center text-sm md:grid-cols-[1.1fr_1.2fr_2fr_1.1fr] md:items-center md:gap-4"
              >
                <span>{formatDate(backup.createdAt)}</span>
                <span className="text-muted-foreground">{getBackupType(backup)}</span>
                <span className="wrap-break-word text-muted-foreground">{getBackupReference(backup)}</span>
                <div className="relative flex items-center justify-center gap-2 pr-20">
                  <span className="text-muted-foreground">{formatBytes(backup.sizeBytes)}</span>
                  <div className="absolute right-0 flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      title="Descargar copia"
                      aria-label="Descargar copia"
                      onClick={() => void downloadBackup(backup)}
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 text-destructive hover:text-destructive"
                      title="Enviar a la papelera"
                      aria-label="Enviar a la papelera"
                      onClick={() => setBackupToDelete(backup)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
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

      <Dialog open={backupToDelete !== null} onOpenChange={(open) => !open && setBackupToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Enviar copia a la papelera</DialogTitle>
            <DialogDescription>
              ¿Querés enviar esta copia de seguridad a la papelera? Podrás restaurarla desde allí.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBackupToDelete(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (backupToDelete) void moveBackupToTrash(backupToDelete);
              }}
            >
              <Trash2 className="size-4" /> Enviar a papelera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
