import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Download,
  Filter,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  pendingComponent: PendingAdminBackups,
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminBackups,
});

const backupsQuery = {
  queryKey: ["admin-backups"],
  staleTime: 60 * 1000,
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

const sortOptions = [
  ["date_desc", "Fecha: más reciente"],
  ["date_asc", "Fecha: más antigua"],
  ["type_asc", "Tipo de copias: A-Z"],
  ["type_desc", "Tipo de copias: Z-A"],
  ["size_desc", "Tamaño: mayor peso"],
  ["size_asc", "Tamaño: menor peso"],
] as const;

type BackupSort = (typeof sortOptions)[number][0];

const getNextWeeklyBackup = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  const current = new Date(
    Date.UTC(Number(parts["year"]), Number(parts["month"]) - 1, Number(parts["day"])),
  );
  const daysUntilMonday = (8 - current.getUTCDay()) % 7 || 7;
  current.setUTCDate(current.getUTCDate() + daysUntilMonday);
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(`${current.toISOString().slice(0, 10)}T00:00:00-03:00`));
};

function PendingAdminBackups() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Respaldo</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Copias de seguridad</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Copias semanales, manuales y por pedido.
          </p>
          <p className="mt-2 text-sm text-primary">
            La próxima copia de seguridad semanal es el {getNextWeeklyBackup()}.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button type="button" variant="outline" disabled className="h-9 gap-1.5 px-2.5">
            <ArrowUpDown className="size-4" /> Ordenar por
          </Button>
          <Button type="button" variant="outline" disabled className="h-9 gap-1.5 px-2.5">
            <Filter className="size-4" /> Filtros
          </Button>
          <Button type="button" variant="outline" disabled className="min-w-44 whitespace-nowrap">
            <Plus className="size-4" /> Crear copia manual
          </Button>
        </div>
      </div>

      <div className="mt-4 glass-panel w-full overflow-hidden rounded-2xl border border-border/60">
        <div className="hidden grid-cols-[1.1fr_1.2fr_2fr_1.1fr] gap-4 border-b border-border/60 bg-surface-2 px-5 py-3 text-center text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground md:grid">
          <span>Fecha</span>
          <span>Tipo de copias</span>
          <span>Referencia</span>
          <span>Tamaño</span>
        </div>
        <div className="flex min-h-40 items-center justify-center gap-3 px-5 py-12 text-center text-sm text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" />
          <span>Cargando copias de seguridad...</span>
        </div>
      </div>
    </main>
  );
}

function AdminBackups() {
  const queryClient = useQueryClient();
  const { data: backups } = useSuspenseQuery(backupsQuery);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isDeletingBackup, setIsDeletingBackup] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<AdminBackupSummary | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<BackupSort>("date_desc");
  const [typesOpen, setTypesOpen] = useState(false);
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [pageSizeInput, setPageSizeInput] = useState("10");
  const [selectedBackupIds, setSelectedBackupIds] = useState<string[]>([]);

  const clearBackupSelection = () => setSelectedBackupIds([]);

  const toggleBackupSelection = (backupId: string, checked: boolean) => {
    setSelectedBackupIds((current) =>
      checked ? [...new Set([...current, backupId])] : current.filter((id) => id !== backupId),
    );
  };

  const toggleAllBackups = (checked: boolean) => {
    setSelectedBackupIds(checked ? visibleBackups.map((backup) => backup.id) : []);
  };

  const deleteSelectedBackups = async () => {
    const selectedIds = new Set(selectedBackupIds);
    const selectedBackups = backups.filter((backup) => selectedIds.has(backup.id));
    for (const backup of selectedBackups) {
      await deleteAdminBackup({ data: { id: backup.id } });
    }
    clearBackupSelection();
    await queryClient.invalidateQueries({ queryKey: backupsQuery.queryKey });
    toast.success("Copias enviadas a la papelera");
  };

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
    setIsDeletingBackup(true);
    try {
      const deleted = await deleteAdminBackup({ data: { id: backup.id } });
      if (!deleted) {
        toast.error("No se pudo enviar la copia a la papelera");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: backupsQuery.queryKey });
      setBackupToDelete(null);
      toast.success("Copia enviada a la papelera");
    } catch {
      toast.error("No se pudo enviar la copia a la papelera");
    } finally {
      setIsDeletingBackup(false);
    }
  };

  const filteredBackups = useMemo(() => {
    const filtered = backups.filter((backup) => {
      const type = getBackupType(backup);
      const date = backup.createdAt.slice(0, 10);
      if (typeFilters.length > 0 && !typeFilters.includes(type)) return false;
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      return true;
    });

    return [...filtered].sort((left, right) => {
      switch (sortOrder) {
        case "date_asc":
          return left.createdAt.localeCompare(right.createdAt);
        case "type_asc":
          return getBackupType(left).localeCompare(getBackupType(right), "es");
        case "type_desc":
          return getBackupType(right).localeCompare(getBackupType(left), "es");
        case "size_asc":
          return left.sizeBytes - right.sizeBytes;
        case "size_desc":
          return right.sizeBytes - left.sizeBytes;
        default:
          return right.createdAt.localeCompare(left.createdAt);
      }
    });
  }, [backups, dateFrom, dateTo, sortOrder, typeFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredBackups.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleBackups = filteredBackups.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const hasPreviousPage = safePage > 0;
  const hasNextPage = safePage < totalPages - 1;

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Respaldo</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Copias de seguridad</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Copias semanales, manuales y por pedido.
          </p>
          <p className="mt-2 text-sm text-primary">
            La próxima copia de seguridad semanal es el {getNextWeeklyBackup()}.
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="order-2 flex min-w-0 flex-row items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x sm:order-none sm:overflow-visible sm:pb-0">
            <Dialog open={sortOpen} onOpenChange={setSortOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 whitespace-nowrap px-2.5"
                >
                  <ArrowUpDown className="size-4" /> Ordenar por
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                <DialogHeader>
                  <DialogTitle>Ordenar por</DialogTitle>
                </DialogHeader>
                <div className="space-y-1 pt-2">
                  {sortOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSortOrder(value);
                        setPage(0);
                        setSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 ${sortOrder === value ? "bg-surface-2 text-foreground" : "text-muted-foreground"}`}
                    >
                      <span>{label}</span>
                      {sortOrder === value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 whitespace-nowrap px-2.5"
                >
                  <Filter className="size-4" /> Filtros
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                <DialogHeader>
                  <DialogTitle>Filtros</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 pt-2">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setTypesOpen((current) => !current)}
                      className="flex items-center gap-1.5 text-left text-sm font-medium"
                      aria-expanded={typesOpen}
                    >
                      <span>Tipo de copias</span>
                      <ChevronDown
                        className={`size-4 text-muted-foreground transition-transform ${typesOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {typesOpen ? (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Checkbox
                            checked={typeFilters.length === 0}
                            onCheckedChange={() => {
                              setTypeFilters([]);
                              setPage(0);
                            }}
                            className="size-4 rounded-full"
                            aria-label="Todas las copias"
                          />
                          Todos
                        </label>
                        {Object.entries({
                          "Copia manual": "Copias manuales",
                          "Copia semanal": "Copias semanales",
                          "Copia por pedido": "Copias por pedidos",
                        }).map(([type, label]) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <Checkbox
                              checked={typeFilters.includes(type)}
                              onCheckedChange={(checked) => {
                                setTypeFilters((current) => {
                                  if (checked !== true) {
                                    return current.filter((value) => value !== type);
                                  }
                                  const next = [...new Set([...current, type])];
                                  return next.length === 3 ? [] : next;
                                });
                                setPage(0);
                              }}
                              className="size-4 rounded-full"
                              aria-label={label}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setDatesOpen((current) => !current)}
                      className="flex items-center gap-1.5 text-left text-sm font-medium"
                      aria-expanded={datesOpen}
                    >
                      <span>Fecha</span>
                      <ChevronDown
                        className={`size-4 text-muted-foreground transition-transform ${datesOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {datesOpen ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-xs text-muted-foreground">
                          Desde
                          <Input
                            type="date"
                            value={dateFrom}
                            onChange={(event) => setDateFrom(event.target.value)}
                            className="scheme-dark h-9 w-full max-w-52"
                          />
                        </label>
                        <label className="space-y-1 text-xs text-muted-foreground">
                          Hasta
                          <Input
                            type="date"
                            value={dateTo}
                            onChange={(event) => setDateTo(event.target.value)}
                            className="scheme-dark h-9 w-full max-w-52"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-4">
                    <span className="text-xs text-muted-foreground">
                      {filteredBackups.length} copias de seguridad encontradas
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-0 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
                      onClick={() => {
                        setTypeFilters([]);
                        setDateFrom("");
                        setDateTo("");
                        setPage(0);
                      }}
                    >
                      <X className="size-3.5" /> Limpiar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isCreatingBackup}
            onClick={() => void handleCreateBackup()}
            className="order-1 h-9 min-w-44 shrink-0 whitespace-nowrap sm:order-none"
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

      <div className="mt-4 glass-panel w-full overflow-hidden rounded-2xl border border-border/60">
        <Table
          hideScrollbarOnMobile
          alwaysShowScrollbarOnDesktop
          containerClassName="[touch-action:pan-x_pan-y] overflow-x-auto overflow-y-visible overscroll-x-contain [-webkit-overflow-scrolling:touch]"
          className="min-w-[54rem] table-fixed text-sm [&_td]:align-middle [&_th]:align-middle [&_td]:py-3 [&_th]:py-3 [&_td]:text-center [&_th]:text-center"
        >
          <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-center [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead className="w-12 min-w-12 max-w-12 px-2 text-center">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={
                      visibleBackups.length > 0 &&
                      visibleBackups.every((backup) => selectedBackupIds.includes(backup.id))
                        ? true
                        : visibleBackups.some((backup) => selectedBackupIds.includes(backup.id))
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(checked) => toggleAllBackups(checked === true)}
                    aria-label="Seleccionar copias visibles"
                  />
                </div>
              </TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo de copias</TableHead>
              <TableHead>Referencia</TableHead>
              <TableHead>Tamaño</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleBackups.length > 0 ? (
              visibleBackups.map((backup: AdminBackupSummary) => (
                <TableRow key={backup.id}>
                  <TableCell className="w-12 min-w-12 max-w-12 px-2 text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedBackupIds.includes(backup.id)}
                        onCheckedChange={(checked) =>
                          toggleBackupSelection(backup.id, checked === true)
                        }
                        aria-label={`Seleccionar ${getBackupType(backup)}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(backup.createdAt)}
                  </TableCell>
                  <TableCell>{getBackupType(backup)}</TableCell>
                  <TableCell className="max-w-72 wrap-break-word text-muted-foreground">
                    {getBackupReference(backup)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatBytes(backup.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
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
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No hay copias de seguridad registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {selectedBackupIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {selectedBackupIds.length} seleccionadas
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void deleteSelectedBackups()}
          >
            <Trash2 className="size-4" /> Enviar seleccionadas a la papelera
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={clearBackupSelection}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      ) : null}

      {filteredBackups.length > 0 ? (
        <div className="mt-3 flex flex-col gap-3">
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
              className="h-8 w-20 bg-background/50 text-center"
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
            {visibleBackups.length} de {filteredBackups.length} copias de seguridad mostradas
          </p>
        </div>
      ) : null}

      <Dialog
        open={backupToDelete !== null}
        onOpenChange={(open) => !open && setBackupToDelete(null)}
      >
        <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Enviar copia de seguridad a la papelera</DialogTitle>
            <DialogDescription>
              ¿Querés enviar esta copia de seguridad a la papelera? Podrás restaurarla desde allí.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingBackup}
              onClick={async () => {
                if (backupToDelete) void moveBackupToTrash(backupToDelete);
              }}
            >
              {isDeletingBackup ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {isDeletingBackup ? "Eliminando..." : "Eliminar copia de seguridad"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
