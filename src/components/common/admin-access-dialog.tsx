import { useState } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    const valid = await verifyAdminPassword({ data: { password } });
    if (!valid) {
      setPasswordError("La contraseña no es válida.");
      return;
    }
    setPassword("");
    onOpenChange(false);
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
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 pr-11"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button type="submit" className="w-full">
            <ArrowRight className="size-4" /> Continuar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
