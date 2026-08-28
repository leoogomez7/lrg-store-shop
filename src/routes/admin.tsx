import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import {
  ContactRound,
  ArrowRight,
  CircleArrowLeft,
  Eye,
  EyeOff,
  House,
  LayoutDashboard,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  Settings,
  Store,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { BrandFooter } from "@/components/layout/brand-footer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { webDesignConfig } from "@/config/brands/web-design.config";
import { getKindeRedirectUri } from "@/lib/kinde";
import { verifyAdminFinalPassword, verifyAdminPassword } from "@/server/admin-auth";
import {
  loadAdminSettings,
  registerAdminIdentity,
  verifyRegisteredAdmin,
} from "@/server/persistence";
import { applyAdminSettings, refreshBrandData } from "@/config/brands";
import { applyTrashEntries } from "@/data/trash";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const navigation = [
  { to: "/", label: "Inicio", icon: House, exact: true },
  { to: "/admin/panel", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/productos", label: "Productos", icon: Package, exact: false },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart, exact: false },
  { to: "/admin/clientes", label: "Clientes", icon: Users, exact: false },
  { to: "/admin/proveedores", label: "Proveedores", icon: ContactRound, exact: false },
  { to: "/admin/marcas", label: "Tiendas disponibles", icon: Store, exact: false },
  { to: "/admin/configuracion", label: "Configuración", icon: Settings, exact: false },
  { to: "/admin/papelera", label: "Papelera", icon: Trash2, exact: false },
] as const;

function AdminLayout() {
  return (
    <KindeAuthGate fallback={<AdminLayoutContent auth={null} />}>
      {(auth) => <AdminLayoutContent auth={auth} />}
    </KindeAuthGate>
  );
}

function AdminLayoutContent({ auth }: { auth: ReturnType<typeof useKindeAuth> | null }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login, register } = auth ?? {
    isAuthenticated: false,
    isLoading: false,
    login: () => undefined,
    register: () => undefined,
  };
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [initialPasswordVerified, setInitialPasswordVerified] = useState(false);
  const [adminIdentityVerified, setAdminIdentityVerified] = useState(false);
  const [adminIdentityChecked, setAdminIdentityChecked] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [finalPassword, setFinalPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showFinalPassword, setShowFinalPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [finalPasswordError, setFinalPasswordError] = useState("");

  useEffect(() => {
    if (!isAuthenticated || !auth?.user?.id) return;
    setAdminIdentityChecked(false);
    const identity = auth.user.email
      ? { id: auth.user.id, email: auth.user.email }
      : { id: auth.user.id };
    void registerAdminIdentity({ data: identity })
      .then((registered) => {
        if (!registered) return false;
        return verifyRegisteredAdmin({ data: identity });
      })
      .then((verified) => {
        setAdminIdentityVerified(Boolean(verified));
        setAdminIdentityChecked(true);
      })
      .catch(() => {
        setAdminIdentityVerified(false);
        setAdminIdentityChecked(true);
      });
  }, [auth?.user?.email, auth?.user?.id, isAuthenticated]);

  useEffect(() => {
    if (!adminIdentityVerified) return;
    void loadAdminSettings({ data: {} })
      .then((settings) => {
        applyAdminSettings(settings);
        const trashSetting = settings.find((setting) => setting.settingKey === "lrg:trash");
        if (trashSetting) {
          try {
            applyTrashEntries(JSON.parse(trashSetting.settingValue));
          } catch {
            applyTrashEntries([]);
          }
        }
        refreshBrandData();
        window.dispatchEvent(new Event("lrg-brand-data-updated"));
      })
      .catch(() => undefined);
  }, [adminIdentityVerified]);

  async function unlockAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    const valid = await verifyAdminPassword({ data: { password } });
    if (!valid) {
      setPasswordError("La contraseña no es válida.");
      return;
    }
    setInitialPasswordVerified(true);
    setPassword("");
  }

  async function unlockFinalAdminAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFinalPasswordError("");
    const valid = await verifyAdminFinalPassword({ data: { password: finalPassword } });
    if (!valid) {
      setFinalPasswordError("La contraseña final de administrador no es válida.");
      return;
    }
    setAdminUnlocked(true);
    setFinalPassword("");
  }

  function startKindeFlow(flow: "login" | "register") {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("lrg_auth_role", "admin");
    }
    const redirectURL = getKindeRedirectUri("/login");
    const options = { redirectURL: redirectURL ?? "http://localhost:5174/login" };
    if (flow === "login") {
      login(options);
    } else {
      register(options);
    }
  }

  if (!adminUnlocked && !isAuthenticated && !initialPasswordVerified) {
    return (
      <div className="theme-webdesign flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <form onSubmit={unlockAdmin} className="glass-card w-full max-w-md space-y-5 p-6">
          <div>
            <p className="text-sm text-muted-foreground">Acceso restringido</p>
            <h1 className="mt-1 text-2xl font-semibold">Administrador</h1>
          </div>
          <label className="block text-sm font-medium" htmlFor="admin-password">
            Contraseña
            <span className="relative mt-2 block">
              <input
                id="admin-password"
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
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
          <Button type="submit" className="w-full">
            <ArrowRight className="size-4" /> Continuar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: "/" })}
          >
            <CircleArrowLeft className="size-4 text-white" /> Volver
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: "/" })}
          >
            <House className="size-4 text-white" /> Inicio
          </Button>
        </form>
      </div>
    );
  }

  if (!adminUnlocked && !isAuthenticated) {
    return (
      <div className="theme-webdesign flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="glass-card w-full max-w-md space-y-5 p-6">
          <div>
            <p className="text-sm text-muted-foreground">Segundo paso</p>
            <h1 className="mt-1 text-2xl font-semibold">Identidad del administrador</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Iniciá sesión o creá la cuenta que usará el panel.
            </p>
          </div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando autenticación...</p>
          ) : (
            <div className="space-y-3">
              <Button type="button" className="w-full" onClick={() => startKindeFlow("login")}>
                <>
                  <User className="h-4 w-4" /> Iniciar sesión
                </>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => startKindeFlow("register")}
              >
                <>
                  <UserPlus className="h-4 w-4" /> Crear cuenta
                </>
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: "/" })}
          >
            <CircleArrowLeft className="size-4 text-white" /> Volver
          </Button>
        </div>
      </div>
    );
  }

  if (!adminUnlocked && isAuthenticated && !adminIdentityChecked) {
    return (
      <div className="theme-webdesign flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="glass-card w-full max-w-md space-y-5 p-6">
          <p className="text-sm text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  if (!adminUnlocked && isAuthenticated && !adminIdentityVerified) {
    return (
      <div className="theme-webdesign flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <div className="glass-card w-full max-w-md space-y-5 p-6">
          <p className="text-sm text-muted-foreground">Acceso no autorizado</p>
          <h1 className="text-2xl font-semibold">Administrador único</h1>
          <p className="text-sm text-muted-foreground">
            Esta cuenta no está autorizada para ingresar al panel administrativo.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: "/" })}
          >
            <CircleArrowLeft className="size-4 text-white" /> Volver
          </Button>
        </div>
      </div>
    );
  }

  if (!adminUnlocked) {
    return (
      <div className="theme-webdesign flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
        <form
          onSubmit={unlockFinalAdminAccess}
          className="glass-card w-full max-w-md space-y-5 p-6"
        >
          <div>
            <p className="text-sm text-muted-foreground">Último paso</p>
            <h1 className="mt-1 text-2xl font-semibold">Confirmar acceso</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ingresá la contraseña final compartida por los administradores.
            </p>
          </div>
          <label className="block text-sm font-medium" htmlFor="admin-final-password">
            Contraseña final de administrador
            <span className="relative mt-2 block">
              <input
                id="admin-final-password"
                type={showFinalPassword ? "text" : "password"}
                value={finalPassword}
                onChange={(event) => setFinalPassword(event.target.value)}
                className="h-11 w-full rounded-md border border-border bg-background px-3 pr-11"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowFinalPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground"
                aria-label={showFinalPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={showFinalPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showFinalPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          {finalPasswordError && <p className="text-sm text-destructive">{finalPasswordError}</p>}
          <Button type="submit" className="w-full">
            <ArrowRight className="size-4" /> Continuar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: "/" })}
          >
            <CircleArrowLeft className="size-4 text-white" /> Volver
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="theme-webdesign min-h-screen bg-background text-foreground">
      <div className="relative flex min-h-screen">
        <aside
          className={cn(
            "hidden shrink-0 border-r border-border/60 bg-surface/40 transition-[width] duration-200 lg:block",
            sidebarCollapsed ? "w-20" : "w-64",
          )}
        >
          <div
            className={cn(
              "sticky top-0 flex h-screen flex-col p-5",
              sidebarCollapsed && "items-center px-3",
            )}
          >
            <div
              className={cn(
                "mb-4 mt-2 flex w-full items-center",
                sidebarCollapsed ? "justify-center" : "justify-between gap-2",
              )}
            >
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                title="LRG Store Shop"
              >
                <BrandMark compact brandSlug="store-shop" />
                {!sidebarCollapsed && (
                  <span className="font-medium text-foreground">LRG Store Shop</span>
                )}
              </Link>
              {!sidebarCollapsed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Minimizar menú"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              )}
            </div>
            {sidebarCollapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(false)}
                title="Expandir menú"
                className="mb-2"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            )}
            <nav className="mt-3 w-full space-y-1">
              {navigation.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      sidebarCollapsed && "justify-center px-2",
                      active
                        ? "bg-surface-2 text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {!sidebarCollapsed && item.label}
                  </Link>
                );
              })}
            </nav>
            <div className={cn("mt-auto flex gap-2", sidebarCollapsed && "justify-center")}>
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-red-600 hover:border-red-500 hover:bg-red-500/10 hover:text-red-600",
                    sidebarCollapsed && "size-9 px-0",
                  )}
                  title={sidebarCollapsed ? "Cerrar sesión" : undefined}
                  onClick={() => setLogoutOpen(true)}
                >
                  {sidebarCollapsed ? <LogOut className="size-4" /> : "Cerrar sesión"}
                </Button>
                <ConfirmDialog
                  open={logoutOpen}
                  onOpenChange={setLogoutOpen}
                  title="¿Cerrar sesión?"
                  description="¿Estás seguro de que deseas cerrar sesión?"
                  confirmLabel="Sí, cerrar sesión"
                  cancelLabel="No"
                  onConfirm={async () => {
                    await logout();
                    navigate({ to: "/" });
                  }}
                />
              </>
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link to="/" className="inline-flex items-center gap-2 shrink-0">
                <BrandMark compact brandSlug="store-shop" />
                <span className="text-sm font-medium text-foreground">LRG Store Shop</span>
              </Link>
              <nav className="flex gap-1 overflow-x-auto">
                {navigation.map((item) => {
                  const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-surface-2 text-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-surface-2 hover:shadow-sm",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>
          <Outlet />
          <BrandFooter brand={webDesignConfig} />
        </div>
      </div>
    </div>
  );
}
