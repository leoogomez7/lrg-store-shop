import { LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="glass-panel flex min-h-56 flex-col items-center justify-center gap-4 rounded-3xl p-12 text-center">
      <LoaderCircle className="size-10 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
