import { useState } from "react";
import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
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
  const [passwordError, setPasswordError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <label className="block text-sm font-medium" htmlFor="admin-access-password">
            Contraseña
            <span className="relative mt-2 block">
              <input
                id="admin-access-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3"
                autoComplete="current-password"
                required
              />
            </span>
          </label>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
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
