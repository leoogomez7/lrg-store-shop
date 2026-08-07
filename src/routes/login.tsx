import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { Button } from "@/components/ui/button";
import { getKindeRedirectUri } from "@/lib/kinde";
import { Mail, Zap } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, isLoading } = useKindeAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/cuenta" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogin = () => {
    const redirectURL = getKindeRedirectUri("/dashboard");
    login({ redirectURL: redirectURL ?? "http://localhost:5174/dashboard" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6 text-lg font-semibold text-foreground">
            <Zap className="h-6 w-6 text-primary" /> LRG Store Shop
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Iniciar sesión</h1>
        </div>

        <div className="glass-card p-6 space-y-6">
          <Button
            type="button"
            disabled={isLoading}
            onClick={handleLogin}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 flex items-center justify-center gap-2 font-semibold"
          >
            <Mail className="h-5 w-5" />
            {isLoading ? "Cargando..." : "Ingresar con email"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿No tienes cuenta? <Link to="/register" className="text-primary hover:underline font-medium">Crear cuenta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
