import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { Button } from "@/components/ui/button";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { getKindeRedirectUri } from "@/lib/kinde";
import { CircleArrowLeft, House, Mail, User, Zap } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  return (
    <KindeAuthGate fallback={<LoginPageContent auth={null} />}>
      {(auth) => <LoginPageContent auth={auth} />}
    </KindeAuthGate>
  );
}

function LoginPageContent({ auth }: { auth: ReturnType<typeof useKindeAuth> | null }) {
  const { login, isAuthenticated, isLoading } = auth ?? {
    login: () => undefined,
    isAuthenticated: false,
    isLoading: false,
  };
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/cuenta" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleLogin = () => {
    const redirectURL = getKindeRedirectUri("/cuenta");
    login({ redirectURL: redirectURL ?? "http://localhost:5174/cuenta" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 mb-6 text-lg font-semibold text-foreground"
          >
            <Zap className="h-6 w-6 text-primary" /> LRG Store Shop
          </Link>
          <h1 className="text-2xl font-bold text-foreground">
            <User className="inline h-6 w-6" /> Iniciar sesión
          </h1>
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

          <p className="flex items-center justify-center gap-1 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Crear cuenta
            </Link>
          </p>
          <div className="mt-4 flex flex-col items-center gap-2">
            <Button
              variant="outline"
              className="w-32"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1)
                  return window.history.back();
                navigate({ to: "/" });
              }}
            >
              <CircleArrowLeft className="size-4 text-white" /> Volver
            </Button>

            <Button variant="outline" onClick={() => navigate({ to: "/" })} className="w-32">
              <House className="size-4 text-white" /> Inicio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
