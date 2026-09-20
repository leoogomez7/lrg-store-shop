import { useEffect, useState } from "react";
import { ArrowRight, CircleArrowLeft, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { verifyAdminFinalPassword, verifyAdminPassword } from "@/server/admin-auth";
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
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-8 shrink-0 text-primary" />
            <DialogTitle>Acceso restringido</DialogTitle>
          </div>
          <DialogDescription className="pl-10">
            Ingresá la contraseña de administrador para continuar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <span className="text-sm font-medium">Contraseña</span>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <input
                  id="admin-access-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-md border border-border bg-background px-3 pr-11 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <Button
                type="submit"
                className="w-full min-w-32 shrink-0 sm:w-auto"
                disabled={isSubmitting}
              >
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
            </div>
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminFinalAccessDialog({
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPasswordError("");
    const valid = await verifyAdminFinalPassword({ data: { password } });
    if (!valid) {
      setPasswordError("La contraseña final de administrador no es válida.");
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
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-8 shrink-0 text-primary" />
            <DialogTitle>Confirmar acceso</DialogTitle>
          </div>
          <DialogDescription className="pl-10">
            Ingresá la contraseña final compartida por los administradores.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <span className="text-sm font-medium">Contraseña final de administrador</span>
            <div className="relative mt-2">
              <input
                id="admin-final-access-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 pr-11 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <div className="flex items-center gap-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Continuar
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              <CircleArrowLeft className="size-4" /> Volver
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
