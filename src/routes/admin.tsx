import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Package, Palette, ShoppingCart } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const navigation = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/productos", label: "Productos", icon: Package, exact: false },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingCart, exact: false },
  { to: "/admin/marcas", label: "Tiendas disponibles", icon: Palette, exact: false },
] as const;

function AdminLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [logoutOpen, setLogoutOpen] = useState(false);

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
        <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-surface/40 lg:block">
          <div className="sticky top-0 flex h-screen flex-col p-5">
            {/* 'Inicio' link removed per request */}
            <Link to="/" className="mb-4 mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <BrandMark compact brandSlug="store-shop" />
              LRG Store Shop
            </Link>
            <nav className="mt-3 space-y-1">
              {navigation.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-surface-2 text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto flex gap-2">
              <Button asChild variant="secondary" size="sm" className="gap-2">
                  <Link to="/">Inicio</Link>
                </Button>
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setLogoutOpen(true)}
                >
                  Cerrar sesión
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
            <div className="flex items-center justify-between">
              <Link to="/">
                <BrandMark compact brandSlug="store-shop" />
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
                        "rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                        active
                          ? "bg-surface-2 text-foreground font-semibold shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
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
        </div>
      </div>
    </div>
  );
}
