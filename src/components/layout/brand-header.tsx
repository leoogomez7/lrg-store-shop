import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { BrandMark } from "@/components/common/brand-mark";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { getStoredActivePanel, getStoredUserDisplayName, logout } from "@/lib/auth";
import { brandList, type BrandConfig } from "@/config/brands";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";

export function BrandHeader({ brand }: { brand: BrandConfig }) {
  return (
    <KindeAuthGate fallback={<BrandHeaderContent brand={brand} auth={null} />}>
      {(auth) => <BrandHeaderContent brand={brand} auth={auth} />}
    </KindeAuthGate>
  );
}

function BrandHeaderContent({
  brand,
  auth,
}: {
  brand: BrandConfig;
  auth: ReturnType<typeof useKindeAuth> | null;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const { count } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { user, logout: kindeLogout } = auth ?? {
    user: null,
    logout: async () => undefined,
  };
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setOpenMenu(false);
  }, [pathname]);
  const [panel, setPanel] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncSessionState = () => {
      setUserName(user ? user.givenName || user.email || null : getStoredUserDisplayName());
      setPanel(user ? "customer" : getStoredActivePanel());
    };

    syncSessionState();

    const onStorage = (e: StorageEvent) => {
      if (["userFullName", "fullName", "name", "userName", "activePanel"].includes(e.key ?? "")) {
        syncSessionState();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleBrandClick = (slug: string, closeMenu = false) => (e: any) => {
    e?.preventDefault?.();
    const href = `/${slug}`;
    if (typeof window !== "undefined" && window.location.pathname === href) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate({ to: "/$brand", params: { brand: slug } });
    }
    if (closeMenu) setOpenMenu(false);
  };

  const links = [
    { label: "Inicio", to: "/", exact: true },
    { label: "Catálogo", to: "/$brand/productos", exact: false },
  ] as const;

  const ecosystemLinks = brandList.map((item) => ({
    label: item.name,
    slug: item.slug,
  }));

  function UserBadge() {
    if (!panel || !userName) return null;

    const roleLabel = panel === "admin" ? "Administrador" : "Cliente";

    return (
      <div className="flex items-center gap-2">
        <div className="px-2 py-1 rounded-md bg-green-50 text-green-800 text-sm font-medium">{userName}</div>
        <div className="px-2 py-1 rounded-md bg-green-600 text-white text-xs font-semibold">{roleLabel}</div>
      </div>
    );
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label="LRG Store Shop">
            <BrandMark compact brandSlug={brand.slug} />
          </Link>

          <a
            href={`/${brand.slug}`}
            onClick={handleBrandClick(brand.slug)}
            className="font-display hidden text-sm font-semibold tracking-tight sm:block"
          >
            {brand.name}
          </a>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const href = link.to.replace("$brand", brand.slug);
              const active = link.exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  params={{ brand: brand.slug }}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Ecosistema
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {ecosystemLinks.map((item) => (
                  <DropdownMenuItem
                    key={item.slug}
                    onSelect={(event) => {
                      event.preventDefault();
                      navigate({ to: "/$brand", params: { brand: item.slug } });
                    }}
                  >
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-3">
              {!userName ? (
                <>
                  <Button
                    onClick={() => navigate({ to: "/register" })}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Crear cuenta
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => navigate({ to: "/login" })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Iniciar sesión
                  </Button>
                </>
              ) : (
                <Link
                  to="/cuenta"
                  aria-label="Mi cuenta"
                  className="text-sm font-medium px-2 py-1 rounded hover:bg-surface-2"
                >
                  Mi cuenta
                </Link>
              )}
            </nav>

            <div className="hidden sm:flex items-center">
              <UserBadge />
            </div>

            {userName ? (
              <>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setLogoutOpen(true)}>
                  Cerrar sesión
                </Button>
                <ConfirmDialog
                  open={logoutOpen}
                  onOpenChange={setLogoutOpen}
                  title="¿Cerrar sesión?"
                  description="¿Deseas cerrar la sesión actual? Se finalizará tu acceso en este dispositivo."
                  confirmLabel="Sí, cerrar sesión"
                  cancelLabel="No"
                  onConfirm={async () => {
                    try {
                      await kindeLogout();
                    } catch (error) {
                      console.error("Error during Kinde logout:", error);
                    }
                    await logout();
                    setUserName(null);
                    setPanel(null);
                  }}
                />
              </>
            ) : null}

            {/* Mobile auth buttons: visible on small screens */}
            <div className="flex md:hidden items-center gap-2">
              {!userName ? (
                <>
                  <Button
                    onClick={() => navigate({ to: "/register" })}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-3 py-1"
                  >
                    Crear cuenta
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate({ to: "/login" })}
                    className="text-muted-foreground hover:text-foreground text-xs px-3 py-1"
                  >
                    Iniciar sesión
                  </Button>
                </>
              ) : (
                <Link to="/cuenta" className="text-sm font-medium px-2 py-1 rounded hover:bg-surface-2">
                  Mi cuenta
                </Link>
              )}
            </div>

            <Link to="/$brand/carrito" params={{ brand: brand.slug }} className="relative inline-flex">
              <Button variant="secondary" size="sm" className="relative gap-2">
                <ShoppingBag className="size-4" />
                <span className="hidden sm:inline">Carrito</span>
                {count > 0 && (
                  <Badge className="absolute -top-2 -right-2 size-5 justify-center rounded-full p-0 text-[0.65rem]">
                    {count}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <div className="h-16" aria-hidden />
    </>
  );
}
