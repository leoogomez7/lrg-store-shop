import { createFileRoute, Link } from "@tanstack/react-router";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { Button } from "@/components/ui/button";
import { getKindeRedirectUri } from "@/lib/kinde";
import { UserPlus, Zap } from "lucide-react";

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function RegisterPage() {
  const { register, isLoading } = useKindeAuth();

  const handleRegister = () => {
    const redirectURL = getKindeRedirectUri("/dashboard");
    register({ redirectURL: redirectURL ?? "http://localhost:5174/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 text-lg font-semibold text-foreground">
            <Zap className="h-6 w-6 text-primary" /> LRG Store Shop
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Crear cuenta</h1>
        </div>

        <div className="glass-card p-6 space-y-6">
          <div className="rounded-2xl border border-border/50 bg-muted/5 p-4 text-sm text-muted-foreground">
            <p>Recibirás un código en tu email para completar el registro y luego serás redirigido a tu cuenta.</p>
          </div>

          <Button
            type="button"
            disabled={isLoading}
            onClick={handleRegister}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 flex items-center justify-center gap-2 font-semibold"
          >
            <UserPlus className="h-5 w-5" />
            {isLoading ? "Cargando..." : "Crear cuenta"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta? <Link to="/login" className="text-primary hover:underline font-medium">Ingresar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
