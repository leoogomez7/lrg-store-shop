import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, ShoppingCart, Store, User, UserPlus, Trash2 } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { toast } from "sonner";
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
import { logout } from "@/lib/auth";
import { brandList, type BrandConfig } from "@/config/brands";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";

export function BrandHeader({
  brand,
  displayBrandName,
  logoBrandSlug,
  headerTheme,
}: {
  brand: BrandConfig;
  displayBrandName?: string;
  logoBrandSlug?: string;
  headerTheme?: string;
}) {
  return (
    <KindeAuthGate
      fallback={
        <BrandHeaderContent
          brand={brand}
          auth={null}
          displayBrandName={displayBrandName}
          logoBrandSlug={logoBrandSlug}
          headerTheme={headerTheme}
        />
      }
    >
      {(auth) => (
        <BrandHeaderContent
          brand={brand}
          auth={auth}
          displayBrandName={displayBrandName}
          logoBrandSlug={logoBrandSlug}
          headerTheme={headerTheme}
        />
      )}
    </KindeAuthGate>
  );
}

function BrandHeaderContent({
  brand,
  auth,
  displayBrandName,
  logoBrandSlug,
  headerTheme,
}: {
  brand: BrandConfig;
  auth: ReturnType<typeof useKindeAuth> | null;
  displayBrandName?: string;
  logoBrandSlug?: string;
  headerTheme?: string;
}) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [openBuyMenu, setOpenBuyMenu] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const { count, items, subtotal, itemsByBrand, setQuantity, removeItem } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { user, logout: kindeLogout } = auth ?? {
    user: null,
    logout: async () => undefined,
  };
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setOpenMenu(false);
    setOpenCart(false);
  }, [pathname]);
  const [panel, setPanel] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: undefined, onConfirm: () => {} });

  useEffect(() => {
    setUserName(user ? user.givenName || user.email || null : null);
    setPanel(user ? (pathname.startsWith("/admin") ? "admin" : "customer") : null);
  }, [pathname, user]);

  const handleBrandClick =
    (slug: string, closeMenu = false) =>
    (e: MouseEvent<HTMLAnchorElement>) => {
      e?.preventDefault?.();
      const href = slug === "store-shop" ? "/" : `/${slug}`;
      if (typeof window !== "undefined" && window.location.pathname === href) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (slug === "store-shop") {
        navigate({ to: "/" });
      } else {
        navigate({ to: "/$brand", params: { brand: slug } });
      }
      if (closeMenu) setOpenMenu(false);
    };

  const defaultLinks: Array<{ label: string; to: string; exact?: boolean }> = [];

  const effectiveSlug = displayBrandName ? (logoBrandSlug ?? brand.slug) : brand.slug;
  const links = defaultLinks;

  const brandLabel = displayBrandName ?? brand.name;
  const brandLogoSlug = logoBrandSlug ?? brand.slug;
  const headerThemeClass = headerTheme ?? brand.theme;
  const brandHref = displayBrandName ? "/" : `/${brand.slug}`;

  const otherBrands = brandList.filter((item) => item.slug !== effectiveSlug);
  const tiendaMenuItems = [
    { slug: "store-shop", name: "LRG Store Shop" },
    ...brandList.filter((item) => item.slug !== "store-shop"),
  ];
  const buyMenuItems = [
    { slug: "store-shop", name: "LRG Store Shop" },
    ...brandList
      .filter((item) => item.slug !== "store-shop")
      .map((item) => ({
        slug: item.slug,
        name: item.name,
      })),
  ];

  function UserBadge() {
    if (!panel || !userName) return null;

    const roleLabel = panel === "admin" ? "Administrador" : "Cliente";

    return (
      <div className="flex items-center gap-2">
        <div className="px-2 py-1 rounded-md bg-green-50 text-green-800 text-sm font-medium">
          {userName}
        </div>
        <div className="px-2 py-1 rounded-md bg-green-600 text-white text-xs font-semibold">
          {roleLabel}
        </div>
      </div>
    );
  }

  return (
    <>
      <header
        className={`${headerThemeClass} fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl`}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" className="shrink-0" aria-label={brandLabel}>
            <BrandMark compact brandSlug={brandLogoSlug} />
          </Link>

          <a
            href={brandHref}
            onClick={handleBrandClick(brandLogoSlug === "store-shop" ? "store-shop" : brand.slug)}
            className="font-display hidden text-sm font-semibold tracking-tight sm:block"
          >
            {brandLabel}
          </a>

          <div className="ml-auto flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-3">
              {links.map((l) => {
                // anchor links for store-shop
                if (l.href && typeof l.href === "string" && l.href.startsWith("#")) {
                  return (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={(e) => {
                        e.preventDefault();
                        if (typeof window !== "undefined") {
                          if (window.location.pathname !== "/") {
                            navigate({ to: "/" });
                            // delay scroll slightly to allow route change
                            setTimeout(() => {
                              const el = document.querySelector(l.href);
                              if (el) el.scrollIntoView({ behavior: "smooth" });
                            }, 80);
                          } else {
                            const el = document.querySelector(l.href);
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }
                        }
                      }}
                      className="text-sm font-medium px-3 py-1 rounded hover:bg-surface-2"
                    >
                      {l.label}
                    </a>
                  );
                }

                // default router links
                if (l.to) {
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      params={{ brand: brand.slug }}
                      className="text-sm font-medium px-3 py-1 rounded hover:bg-surface-2"
                    >
                      {l.label}
                    </Link>
                  );
                }

                return null;
              })}

              {!userName ? (
                <>
                  <Button
                    asChild
                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Link to="/register">
                      <UserPlus className="h-4 w-4" /> Crear cuenta
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="ghost"
                    className="rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <Link to="/login">
                      <User className="h-4 w-4" /> Iniciar sesión
                    </Link>
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

            {/* Mobile auth buttons: visible on small screens */}
            <div className="flex md:hidden items-center gap-2">
              {!userName ? (
                <>
                  <Button
                    onClick={() => navigate({ to: "/register" })}
                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs px-3 py-1"
                  >
                    <>
                      <UserPlus className="h-4 w-4" /> Crear cuenta
                    </>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate({ to: "/login" })}
                    className="rounded-xl text-muted-foreground hover:text-foreground text-xs px-3 py-1"
                  >
                    <>
                      <User className="h-4 w-4" /> Iniciar sesión
                    </>
                  </Button>
                </>
              ) : (
                <Link
                  to="/cuenta"
                  className="text-sm font-medium px-2 py-1 rounded-xl hover:bg-surface-2"
                >
                  Mi cuenta
                </Link>
              )}
            </div>

            <DropdownMenu open={openBuyMenu} onOpenChange={setOpenBuyMenu}>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="rounded-xl gap-2">
                  <ShoppingBag className="size-4" />
                  <span className="hidden sm:inline">Comprar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {buyMenuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.slug}
                    onSelect={() => {
                      if (item.slug === "store-shop") {
                        navigate({ to: "/productos" });
                      } else {
                        navigate({ to: "/$brand/productos", params: { brand: item.slug } });
                      }
                      setOpenMenu(false);
                    }}
                  >
                    Comprar en {item.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={openCart} onOpenChange={setOpenCart}>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="rounded-xl relative gap-2">
                  <ShoppingCart className="size-4" />
                  <span className="hidden sm:inline">Carrito</span>
                  {count > 0 && (
                    <Badge className="absolute -top-2 -right-2 size-5 justify-center rounded-full p-0 text-[0.65rem]">
                      {count}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                {count === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Tu carrito está vacío
                  </div>
                ) : (
                  <>
                    <div className="max-h-80 overflow-y-auto">
                      {items.map((item) => {
                        const itemBrand = brandList.find((b) => b.slug === item.brand);
                        return (
                          <div
                            key={item.id}
                            className="px-4 py-3 border-b text-sm hover:bg-accent/50"
                          >
                            <div className="font-medium truncate mb-1">{item.name}</div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Badge variant="outline" className="text-xs shrink-0">
                                {itemBrand?.name || item.brand}
                              </Badge>
                              <div className="text-xs text-muted-foreground shrink-0">
                                ${item.price.toFixed(2)}
                              </div>
                              <div className="font-semibold shrink-0 text-right flex-1">
                                ${(item.price * item.quantity).toFixed(2)}
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() =>
                                    setQuantity(item.id, Math.max(1, item.quantity - 1))
                                  }
                                >
                                  -
                                </Button>
                                <span className="w-6 text-center text-xs font-medium">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    if (item.quantity >= item.stock) {
                                      toast.error("No hay más stock disponible para agregar.", {
                                        description: `${item.name} alcanzó su límite de stock.`,
                                      });
                                      return;
                                    }
                                    setQuantity(item.id, item.quantity + 1);
                                  }}
                                >
                                  +
                                </Button>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                                onClick={() => removeItem(item.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="border-t px-4 py-3 space-y-2">
                      <div className="flex justify-between items-center font-semibold mb-3">
                        <span>Subtotal:</span>
                        <span>
                          $
                          {items
                            .reduce((acc, item) => acc + item.price * item.quantity, 0)
                            .toFixed(2)}
                        </span>
                      </div>
                      <Button
                        onClick={() => {
                          navigate({ to: `/${brand.slug}/productos` });
                          setOpenCart(false);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Seguir comprando
                      </Button>
                      <Link
                        to="/carrito"
                        className="w-full block"
                        onClick={() => setOpenCart(false)}
                      >
                        <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                          Ver carrito completo
                        </Button>
                      </Link>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu open={openMenu} onOpenChange={setOpenMenu}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-xl gap-2">
                  <Store className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Tiendas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {tiendaMenuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.slug}
                    onSelect={() => {
                      handleBrandClick(item.slug)();
                      setOpenMenu(false);
                    }}
                  >
                    {item.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
