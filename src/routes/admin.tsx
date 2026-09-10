import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import {
  AlertTriangle,
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
import { LoadingState } from "@/components/common/loading-state";
import { BrandFooter } from "@/components/layout/brand-footer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { webDesignConfig } from "@/config/brands/web-design.config";
import { getKindeRedirectUri } from "@/lib/kinde";
import { verifyAdminFinalPassword, verifyAdminPassword } from "@/server/admin-auth";
import { loadAdminSettings } from "@/server/persistence";
import { applyAdminSettings, refreshBrandData } from "@/config/brands";
import { applyTrashEntries } from "@/data/trash";
import { catalogQueries, orderQueries } from "@/services/catalog.service";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/admin") {
      throw redirect({ to: "/admin/panel" });
    }
    return undefined as never;
  },
  component: AdminLayout,
});

const navigation = [
  { to: "/", label: "Inicio", icon: House, exact: true },
  { to: "/admin/panel", label: "Panel administrativo", icon: LayoutDashboard, exact: true },
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
  const {
    isAuthenticated,
    isLoading,
    login,
    register,
    logout: kindeLogout,
  } = auth ?? {
    isAuthenticated: false,
    isLoading: false,
    login: () => undefined,
    register: () => undefined,
    logout: async () => undefined,
  };
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [initialPasswordVerified, setInitialPasswordVerified] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(
    () =>
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("lrg_admin_final_verified") === "true",
  );
  const [password, setPassword] = useState("");
  const [finalPassword, setFinalPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showFinalPassword, setShowFinalPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [finalPasswordError, setFinalPasswordError] = useState("");
  const hasVerifiedAdminAccess = isAuthenticated && adminUnlocked;

  useEffect(() => {
    if (!isAuthenticated) {
      setAdminUnlocked(false);
      setInitialPasswordVerified(false);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("lrg_admin_final_verified");
        window.sessionStorage.removeItem("lrg_auth_role");
      }
      return;
    }

    if (pathname === "/admin") {
      navigate({ to: "/admin/panel", replace: true });
      return;
    }
  }, [isAuthenticated, navigate, pathname]);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    if (window.sessionStorage.getItem("lrg_auth_role") !== "admin") {
      navigate({ to: "/cuenta/panel", replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
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
  }, [isAuthenticated]);

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
    startKindeFlow("login");
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

  async function unlockFinalAdminAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFinalPasswordError("");
    const valid = await verifyAdminFinalPassword({ data: { password: finalPassword } });
    if (!valid) {
      setFinalPasswordError("La contraseña final de administrador no es válida.");
      return;
    }
    setAdminUnlocked(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("lrg_admin_final_verified", "true");
    }
    setFinalPassword("");
    navigate({ to: "/admin/panel" });
  }

  if (isLoading && initialPasswordVerified) {
    return <LoadingState label="Cargando autenticación..." />;
  }

  if (!hasVerifiedAdminAccess && !isAuthenticated && !initialPasswordVerified) {
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

  if (!hasVerifiedAdminAccess && !isAuthenticated) {
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

  if (!hasVerifiedAdminAccess) {
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
                      "group relative flex items-center gap-2.5 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all duration-300 ease-out before:absolute before:inset-0 before:rounded-xl before:bg-linear-to-r before:from-white/10 before:via-white/5 before:to-transparent before:opacity-0 before:transition-all before:duration-300 before:content-[''] hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] hover:text-foreground hover:before:opacity-100",
                      sidebarCollapsed && "justify-center px-2",
                      active
                        ? "border-white/10 bg-surface-2 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-muted-foreground",
                    )}
                  >
                    <item.icon className="relative z-10 size-4 shrink-0" />
                    {!sidebarCollapsed && <span className="relative z-10">{item.label}</span>}
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
                  <LogOut className="size-4" />
                  {!sidebarCollapsed && "Cerrar sesión"}
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
                    await kindeLogout();
                    if (typeof window !== "undefined") {
                      window.sessionStorage.removeItem("lrg_auth_role");
                      window.sessionStorage.removeItem("lrg_admin_final_verified");
                      window.sessionStorage.removeItem("lrg_admin_entry_notice_shown");
                    }
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
                        "group relative overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-sm transition-all duration-300 ease-out before:absolute before:inset-0 before:rounded-xl before:bg-linear-to-r before:from-white/10 before:via-white/5 before:to-transparent before:opacity-0 before:transition-all before:duration-300 before:content-[''] hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] hover:before:opacity-100",
                        active
                          ? "border-white/10 bg-surface-2 text-foreground font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "text-muted-foreground",
                      )}
                    >
                      <span className="relative z-10">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </header>
          <Outlet />
          <BrandFooter brand={webDesignConfig} section="admin" />
        </div>
      </div>
      <AdminEntryNotice />
    </div>
  );
}

type AdminEntryNoticeData = {
  lowStock: Array<{ id: string; name: string; variantName?: string; stock: number }>;
  newOrders: Array<{ id: string; customer: string; date: string; total: number }>;
};

function AdminEntryNotice() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const [notice, setNotice] = useState<AdminEntryNoticeData | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const noticeShownKey = "lrg_admin_entry_notice_shown";
    if (window.sessionStorage.getItem(noticeShownKey) === "true") return;

    const previousLogin = window.localStorage.getItem("lrg_admin_last_login");
    const previousLoginTime = previousLogin ? new Date(previousLogin).getTime() : NaN;
    const lowStock = products
      .flatMap((product) =>
        product.variants?.length
          ? product.variants.map((variant) => ({
              id: `${product.id}-${variant.id}`,
              name: product.name,
              variantName: variant.name,
              stock: variant.stock,
            }))
          : [{ id: product.id, name: product.name, stock: product.stock }],
      )
      .filter((product) => product.stock <= 5)
      .sort((first, second) => first.stock - second.stock);
    const newOrders = orders
      .filter((order) => {
        if (!Number.isFinite(previousLoginTime)) return true;
        const orderTime = new Date(order.date).getTime();
        return Number.isFinite(orderTime) && orderTime >= previousLoginTime;
      })
      .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
      .slice(0, 8)
      .map((order) => ({
        id: order.id,
        customer: order.customer,
        date: order.date,
        total: order.total,
      }));

    window.localStorage.setItem("lrg_admin_last_login", new Date().toISOString());
    window.sessionStorage.setItem(noticeShownKey, "true");
    if (lowStock.length > 0 || newOrders.length > 0) {
      setNotice({ lowStock, newOrders });
    }
  }, [orders, products]);

  if (!notice) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && setNotice(null)}>
      <DialogContent className="max-w-2xl overflow-hidden border-primary/40 bg-background/95 p-0 shadow-2xl shadow-primary/20">
        <div className="h-2 bg-primary" />
        <div className="p-6 sm:p-8">
          <DialogHeader>
            <div className="mb-3 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <DialogTitle>Resumen al ingresar</DialogTitle>
                <DialogDescription>Hay novedades que requieren tu atención.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <section className="rounded-xl border border-border/60 bg-surface/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Stock bajo o agotado</h3>
                <Badge variant="destructive">{notice.lowStock.length}</Badge>
              </div>
              {notice.lowStock.length > 0 ? (
                <ul className="max-h-52 space-y-2 overflow-y-auto text-sm text-muted-foreground">
                  {notice.lowStock.map((product) => (
                    <li key={product.id} className="flex items-start justify-between gap-3">
                      <span>
                        {product.name}
                        {product.variantName ? ` · ${product.variantName}` : ""}
                      </span>
                      <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
                        {product.stock} u.
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No hay productos con stock bajo.</p>
              )}
            </section>

            <section className="rounded-xl border border-border/60 bg-surface/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Compras recientes</h3>
                <Badge variant="secondary">{notice.newOrders.length}</Badge>
              </div>
              {notice.newOrders.length > 0 ? (
                <ul className="max-h-52 space-y-2 overflow-y-auto text-sm text-muted-foreground">
                  {notice.newOrders.map((order) => (
                    <li key={order.id} className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-medium text-foreground">{order.customer}</span>
                        <span className="text-xs">{order.id} · {formatDate(order.date)}</span>
                      </span>
                      <span className="whitespace-nowrap">${order.total.toLocaleString("es-AR")}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No hay compras nuevas desde el último ingreso.</p>
              )}
            </section>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" onClick={() => setNotice(null)}>
              Entendido
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
