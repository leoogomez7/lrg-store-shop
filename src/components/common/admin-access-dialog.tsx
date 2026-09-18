import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { verifyAdminPassword } from "@/server/admin-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AdminAccessDialog({
  open,
  onOpenChange,
  onAuthorized,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthorized: () => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) return;
    setPassword("");
    setPasswordError("");
    setIsSubmitting(false);
    setShowPassword(false);
  }, [open]);

  useEffect(() => {
    const resetDialogState = () => {
      setPassword("");
      setPasswordError("");
      setIsSubmitting(false);
      setShowPassword(false);
    };

    window.addEventListener("pageshow", resetDialogState);
    window.addEventListener("popstate", resetDialogState);
    return () => {
      window.removeEventListener("pageshow", resetDialogState);
      window.removeEventListener("popstate", resetDialogState);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPasswordError("");
    const valid = await verifyAdminPassword({ data: { password } });
    if (!valid) {
      setPasswordError("La contraseña no es válida.");
      setIsSubmitting(false);
      return;
    }
    setPassword("");
    onAuthorized();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <ShieldCheck className="mx-auto size-8 text-primary sm:mx-0" />
          <DialogTitle>Acceso restringido</DialogTitle>
          <DialogDescription>
            Ingresá la contraseña de administrador para continuar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-medium" htmlFor="admin-access-password">
              Contraseña
              <input
                id="admin-access-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 h-11 w-full rounded-md border border-border bg-background px-3"
                autoComplete="current-password"
                required
              />
            </label>
            <button
              type="button"
              className="mb-0 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button type="submit" className="w-auto min-w-32" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoaderCircle className="size-4 animate-spin" /> Cargando...
              </>
            ) : (
              <>
                <ArrowRight className="size-4" /> Continuar
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
