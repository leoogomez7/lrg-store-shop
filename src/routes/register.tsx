import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { AdminAccessDialog } from "@/components/common/admin-access-dialog";
import { getKindeRedirectUri } from "@/lib/kinde";
import { CircleArrowLeft, House, ShieldCheck, User, UserPlus, UsersRound, Zap } from "lucide-react";

export const Route = createFileRoute("/register")({
  validateSearch: z.object({ role: z.enum(["client", "admin"]).optional() }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <KindeAuthGate fallback={<RegisterPageContent auth={null} />}>
      {(auth) => <RegisterPageContent auth={auth} />}
    </KindeAuthGate>
  );
}

function RegisterPageContent({ auth }: { auth: ReturnType<typeof useKindeAuth> | null }) {
  const { register, isAuthenticated, isLoading } = auth ?? {
    register: () => undefined,
    isAuthenticated: false,
    isLoading: false,
  };
  const navigate = useNavigate();
  const { role: requestedRole } = Route.useSearch();
  const [role, setRole] = useState<"client" | "admin" | null>(requestedRole ?? null);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [adminAuthorized, setAdminAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      toast.info("Ya hay un usuario logueado", {
        className: "!border-gray-200 !bg-white !text-gray-900",
      });
      navigate({ to: "/cuenta" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const startRegister = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("lrg_auth_role", role ?? "client");
    }
    const redirectURL = getKindeRedirectUri("/login");
    register({
      redirectURL: redirectURL ?? "http://localhost:5174/login",
    });
  };

  const handleRegister = () => {
    if (role === "admin" && !adminAuthorized) {
      setAdminAccessOpen(true);
      return;
    }
    startRegister();
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
            <UserPlus className="inline h-6 w-6" /> Crear cuenta
          </h1>
        </div>

        <div className="glass-card p-6 space-y-6">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={role === "client" ? "default" : "outline"}
              onClick={() => setRole("client")}
              className="h-11"
            >
              <UsersRound className="size-4" /> Cliente
            </Button>
            <Button
              type="button"
              variant={role === "admin" ? "default" : "outline"}
              onClick={() => setRole("admin")}
              className="h-11"
            >
              <ShieldCheck className="size-4" /> Administrador
            </Button>
          </div>
          <div className="rounded-2xl border border-border/50 bg-muted/5 p-4 text-sm text-muted-foreground">
            <p>
              Recibirás un código en tu email para completar el registro y luego serás redirigido a
              tu cuenta.
            </p>
          </div>

          <Button
            type="button"
            disabled={isLoading || role === null}
            onClick={handleRegister}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 flex items-center justify-center gap-2 font-semibold"
          >
            {isLoading ? (
              "Cargando..."
            ) : (
              <>
                <UserPlus className="h-5 w-5" />
                {role === "admin"
                  ? "Crear cuenta como administrador"
                  : role === "client"
                    ? "Crear cuenta como cliente"
                    : "Crear cuenta"}
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tenés cuenta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Ingresar
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
        <AdminAccessDialog
          open={adminAccessOpen}
          onOpenChange={setAdminAccessOpen}
          onAuthorized={() => {
            setAdminAuthorized(true);
            startRegister();
          }}
        />
      </div>
    </div>
  );
}
