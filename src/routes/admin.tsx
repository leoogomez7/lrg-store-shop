import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ContactRound, House, LayoutDashboard, LogOut, Package, PanelLeftClose, PanelLeftOpen, ShoppingCart, Settings, Store, Trash2, Users } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { BrandFooter } from "@/components/layout/brand-footer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { webDesignConfig } from "@/config/brands/web-design.config";

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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // preserve any existing active admin session, but do not create a default one
    try {
      const activePanel = sessionStorage.getItem("activePanel");
      if (activePanel !== "admin") {
        return;
      }
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <div className="theme-webdesign min-h-screen bg-background text-foreground">
      <div className="relative flex min-h-screen">
        <aside className={cn("hidden shrink-0 border-r border-border/60 bg-surface/40 transition-[width] duration-200 lg:block", sidebarCollapsed ? "w-20" : "w-64")}>
          <div className={cn("sticky top-0 flex h-screen flex-col p-5", sidebarCollapsed && "items-center px-3")}>
            <div className={cn("mb-4 mt-2 flex w-full items-center", sidebarCollapsed ? "justify-center" : "justify-between gap-2")}>
              <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" title="LRG Store Shop">
              <BrandMark compact brandSlug="store-shop" />
              {!sidebarCollapsed && <span className="font-medium text-foreground">LRG Store Shop</span>}
              </Link>
              {!sidebarCollapsed && <Button type="button" variant="ghost" size="icon" onClick={() => setSidebarCollapsed(true)} title="Minimizar menú"><PanelLeftClose className="size-4" /></Button>}
            </div>
            {sidebarCollapsed && <Button type="button" variant="ghost" size="icon" onClick={() => setSidebarCollapsed(false)} title="Expandir menú" className="mb-2"><PanelLeftOpen className="size-4" /></Button>}
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
