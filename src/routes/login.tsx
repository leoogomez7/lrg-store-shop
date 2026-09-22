import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { AdminAccessDialog, AdminFinalAccessDialog } from "@/components/common/admin-access-dialog";
import { getKindeRedirectUri } from "@/lib/kinde";
import { getAuthRole, setAuthRole } from "@/lib/auth-role";
import {
  CircleArrowLeft,
  House,
  LoaderCircle,
  ShieldCheck,
  User,
  UsersRound,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ role: z.enum(["client", "admin"]).optional() }),
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
  const { role: requestedRole } = Route.useSearch();
  const [role, setRole] = useState<"client" | "admin" | null>(requestedRole ?? null);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [adminFinalAccessOpen, setAdminFinalAccessOpen] = useState(false);
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [isStartingLogin, setIsStartingLogin] = useState(false);
  const isAdminLoginFlow = role === "admin" || getAuthRole() === "admin";

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (
        isAdminLoginFlow &&
        typeof window !== "undefined" &&
        window.localStorage.getItem("lrg_admin_final_verified") !== "true"
      ) {
        setAdminFinalAccessOpen(true);
        return;
      }
      toast.info("Ya hay un usuario logueado", {
        className: "!border-gray-200 !bg-white !text-gray-900",
      });
      const destination = getAuthRole() === "admin" ? "/admin/panel" : "/cuenta/panel";
      navigate({ to: destination });
    }
  }, [isAdminLoginFlow, isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    const resetLoginState = () => setIsStartingLogin(false);
    window.addEventListener("pageshow", resetLoginState);
    window.addEventListener("popstate", resetLoginState);
    return () => {
      window.removeEventListener("pageshow", resetLoginState);
      window.removeEventListener("popstate", resetLoginState);
    };
  }, []);

  const startLogin = () => {
    setIsStartingLogin(true);
    if (typeof window !== "undefined") {
      setAuthRole(role ?? "client");
    }
    const redirectURL = getKindeRedirectUri("/login");
    login({
      redirectURL: redirectURL ?? "http://localhost:5174/login",
    });
  };

  if (isStartingLogin || isLoading || (isAuthenticated && !adminFinalAccessOpen)) {
    return (
      <div className="theme-webdesign flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="text-center">
          <LoaderCircle className="mx-auto mb-4 size-10 animate-spin text-primary" />
          <p className="text-lg font-semibold">Iniciando sesión...</p>
          <p className="mt-1 text-sm text-muted-foreground">Preparando tu panel...</p>
        </div>
      </div>
    );
  }

  const handleLogin = () => {
    if (role === "admin" && !adminAuthorized) {
      setAdminAccessOpen(true);
      return;
    }
    startLogin();
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
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={role === "client" ? "default" : "outline"}
              onClick={() => setRole("client")}
              className="h-9"
            >
              <UsersRound className="size-4" /> Cliente
            </Button>
            <Button
              type="button"
              variant={role === "admin" ? "default" : "outline"}
              onClick={() => setRole("admin")}
              className="h-9"
            >
              <ShieldCheck className="size-4" /> Administrador
            </Button>
          </div>
          <Button
            type="button"
            disabled={isLoading || role === null}
            onClick={handleLogin}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-12 flex items-center justify-center gap-2 font-semibold"
          >
            <User className="h-5 w-5" />
            {isLoading
              ? "Cargando..."
              : role === "admin"
                ? "Ingresar como administrador"
                : role === "client"
                  ? "Ingresar como cliente"
                  : "Iniciar sesión"}
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
      <AdminAccessDialog
        open={adminAccessOpen}
        onOpenChange={setAdminAccessOpen}
        onAuthorized={() => {
          setAdminAuthorized(true);
          startLogin();
        }}
      />
      <AdminFinalAccessDialog
        open={adminFinalAccessOpen}
        onOpenChange={setAdminFinalAccessOpen}
        onAuthorized={() => {
          window.localStorage.setItem("lrg_admin_final_verified", "true");
          setAdminFinalAccessOpen(false);
          navigate({ to: "/admin/panel", replace: true });
        }}
      />
    </div>
  );
}
