import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  House,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  CloudDownload,
  ShoppingBag,
  ShoppingCart,
  Store,
  ContactRound,
  Settings,
  User,
  Users,
  Trash2,
} from "lucide-react";
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
import { KINDE_LOGOUT_REDIRECT_URI, getKindeRedirectUri } from "@/lib/kinde";
import { brandList, type BrandConfig } from "@/config/brands";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart-context";
import { getAuthRole } from "@/lib/auth-role";

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
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const { count, items, subtotal, itemsByBrand, setQuantity, removeItem } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { user, logout: kindeLogout } = auth ?? {
    user: null,
    logout: async () => undefined,
  };
  const [userName, setUserName] = useState<string | null>(null);
  const [userFamilyName, setUserFamilyName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "client">("client");

  useEffect(() => {
    setOpenMenu(false);
    setOpenCart(false);
    setOpenUserMenu(false);
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
    setUserFamilyName(user?.familyName || null);
    setUserRole(pathname.startsWith("/admin") || getAuthRole() === "admin" ? "admin" : "client");
    setPanel(user ? (pathname.startsWith("/admin") ? "admin" : "customer") : null);
  }, [pathname, user]);

  const handleBrandClick =
    (slug: string, closeMenu = false) =>
    (e: MouseEvent<HTMLAnchorElement>) => {
      e?.preventDefault?.();
      const href = slug === "store-shop" ? "/productos" : `/${slug}`;
      if (typeof window !== "undefined" && window.location.pathname === href) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (slug === "store-shop") {
        navigate({ to: "/productos" });
      } else {
        navigate({ to: "/$brand", params: { brand: slug } });
      }
      if (closeMenu) setOpenMenu(false);
    };

  const defaultLinks: Array<{ label: string; to?: string; href?: string; exact?: boolean }> = [];

  const effectiveSlug = displayBrandName ? (logoBrandSlug ?? brand.slug) : brand.slug;
  const links = defaultLinks;

  const brandLabel = displayBrandName ?? brand.name;
  const brandLogoSlug = logoBrandSlug ?? brand.slug;
  const headerThemeClass = headerTheme ?? brand.theme;
  const brandHref = displayBrandName ? "/productos" : `/${brand.slug}`;

  const otherBrands = brandList.filter((item) => item.slug !== effectiveSlug);
  const tiendaMenuItems = [{ slug: "store-shop" as const, name: "LRG Store Shop" }, ...brandList];
  const buyMenuItems = [
    { slug: "store-shop" as const, name: "LRG Store Shop" },
    ...brandList.map((item) => ({
      slug: item.slug,
      name: item.name,
    })),
  ];

  const isAdmin = userRole === "admin";
  const userRoleLabel = isAdmin ? "Administrador" : "Cliente";
  const userInitials =
    [userName, userFamilyName]
      .filter((value): value is string => Boolean(value && value !== user?.email))
      .map((value) => value.trim().charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";
  const userMenuItems = isAdmin
    ? [
        { label: "Panel administrativo", to: "/admin/panel", icon: LayoutDashboard },
        { label: "Productos", to: "/admin/productos", icon: Package },
        { label: "Pedidos", to: "/admin/pedidos", icon: ShoppingCart },
        { label: "Clientes", to: "/admin/clientes", icon: Users },
        { label: "Proveedores", to: "/admin/proveedores", icon: ContactRound },
        { label: "Tiendas disponibles", to: "/admin/marcas", icon: Store },
        { label: "Configuración", to: "/admin/configuracion", icon: Settings },
        { label: "Papelera", to: "/admin/papelera", icon: Trash2 },
        { label: "Copias de seguridad", to: "/admin/copias", icon: CloudDownload },
      ]
    : [
        { label: "Panel administrativo", to: "/cuenta/panel", icon: LayoutDashboard },
        { label: "Compras", to: "/cuenta/compras", icon: ShoppingCart },
        { label: "Perfil", to: "/cuenta/perfil", icon: User },
        { label: "Direcciones", to: "/cuenta/direcciones", icon: MapPin },
        { label: "Favoritos", to: "/cuenta/favoritos", icon: Heart },
      ];

  function UserBadge() {
    if (!panel || !userName) return null;

    return (
      <DropdownMenu modal={false} open={openUserMenu} onOpenChange={setOpenUserMenu}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Menú de ${userRoleLabel}`}
            className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold uppercase text-white transition-opacity hover:opacity-85 ${
              isAdmin ? "bg-amber-600" : "bg-green-600"
            }`}
          >
            {userInitials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56 w-auto p-1">
          <div className="border-b px-3 py-2">
            <div className="truncate text-sm font-semibold">{userName}</div>
            <div className="text-xs text-muted-foreground">{userRoleLabel}</div>
          </div>
          {userMenuItems.map(({ label, to, icon: Icon }) => (
            <DropdownMenuItem key={to} asChild>
              <Link
                to={to as "/"}
                onClick={() => setOpenUserMenu(false)}
                className="whitespace-nowrap"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            className="whitespace-nowrap bg-red-50 font-semibold text-red-600 hover:bg-red-100 hover:text-red-700 focus:bg-red-100 focus:text-red-700"
            onSelect={() => {
              setOpenUserMenu(false);
              setLogoutOpen(true);
            }}
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <header
        className={`${headerThemeClass} fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl`}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl min-w-0 items-center gap-1 overflow-visible px-2 sm:gap-4 sm:px-6">
          <Link
            to={displayBrandName ? "/productos" : "/"}
            className="shrink-0"
            aria-label={brandLabel}
          >
            <BrandMark compact brandSlug={brandLogoSlug} />
          </Link>

          <a
            href={brandHref}
            onClick={handleBrandClick(brandLogoSlug === "store-shop" ? "store-shop" : brand.slug)}
            className="font-display hidden text-sm font-semibold tracking-tight sm:block"
          >
            {brandLabel}
          </a>

          <div
            className={`ml-auto flex min-w-0 items-center gap-0 overflow-visible ${
              userName ? "sm:gap-1" : "sm:gap-0"
            }`}
          >
            <nav className="order-3 hidden items-center gap-0 md:flex">
              {links.map((l) => {
                // anchor links for store-shop
                if (l.href && typeof l.href === "string" && l.href.startsWith("#")) {
                  return (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={(e) => {
                        e.preventDefault();
                        const anchorSelector = l.href;
                        if (typeof window !== "undefined" && anchorSelector) {
                          if (window.location.pathname !== "/") {
                            navigate({ to: "/" });
                            setTimeout(() => {
                              const el = document.querySelector(anchorSelector);
                              if (el) el.scrollIntoView({ behavior: "smooth" });
                            }, 80);
                          } else {
                            const el = document.querySelector(anchorSelector);
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }
                        }
                      }}
                      className="inline-flex h-9 items-center rounded px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
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
                      className="inline-flex h-9 items-center rounded px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
                    >
                      {l.label}
                    </Link>
                  );
                }

                return null;
              })}

              {!userName ? (
                <>
                  <Button asChild variant="ghost" className="rounded-xl">
                    <Link to="/login">
                      <User className="h-4 w-4" /> Iniciar sesión
                    </Link>
                  </Button>

                  <Button asChild variant="ghost" className="rounded-xl">
                    <Link to="/register">
                      <UserPlus className="h-4 w-4" /> Crear cuenta
                    </Link>
                  </Button>
                </>
              ) : null}
            </nav>

            <DropdownMenu modal={false} open={openCart} onOpenChange={setOpenCart}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="order-5 relative -ml-2 rounded-xl gap-2 px-2 sm:-ml-2 sm:px-2"
                  title="Carrito"
                >
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
                            <div className="mb-1 min-w-0">
                              <div className="truncate font-medium">{item.name}</div>
                              {item.variantName ? (
                                <div className="truncate text-xs text-muted-foreground">
                                  {item.variantName}
                                </div>
                              ) : null}
                            </div>
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
                                    if (!item.stockUnlimited && item.quantity >= item.stock) {
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

            <div className="order-6 ml-2 flex items-center sm:ml-3">
              <UserBadge />
            </div>

            {/* Mobile auth buttons: visible on small screens */}
            <div className="order-3 flex items-center gap-0 md:hidden">
              {!userName ? (
                <>
                  <Button
                    onClick={() => navigate({ to: "/login" })}
                    variant="ghost"
                    className="rounded-xl px-1.5 py-2 sm:px-3 sm:py-1"
                    title="Iniciar sesión"
                    aria-label="Iniciar sesión"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">Iniciar sesión</span>
                  </Button>
                  <Button
                    onClick={() => navigate({ to: "/register" })}
                    variant="ghost"
                    className="rounded-xl px-1.5 py-2 sm:px-3 sm:py-1"
                    title="Crear cuenta"
                    aria-label="Crear cuenta"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Crear cuenta</span>
                  </Button>
                </>
              ) : null}
            </div>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="order-4 rounded-xl gap-2 px-2 sm:px-2"
              title="Comprar"
            >
              <Link to="/productos" aria-label="Comprar" title="Comprar">
                <ShoppingBag className="size-4" />
                <span className="hidden sm:inline">Comprar</span>
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="order-0 rounded-xl gap-2 px-2 sm:px-3"
            >
              <Link to="/" aria-label="Inicio" title="Inicio">
                <House className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Inicio</span>
              </Link>
            </Button>

            <DropdownMenu modal={false} open={openMenu} onOpenChange={setOpenMenu}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="order-1 rounded-xl gap-2 px-2 sm:px-3"
                  title="Tiendas"
                >
                  <Store className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Tiendas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-60 w-auto p-1">
                {tiendaMenuItems.map((item) => {
                  const content = (
                    <>
                      <BrandMark compact brandSlug={item.slug} className="shrink-0" />
                      <span>{item.name}</span>
                    </>
                  );
                  const handleClick = () => {
                    const nextHref =
                      item.slug === "store-shop" ? "/productos" : `/${item.slug}/productos`;
                    if (typeof window !== "undefined" && window.location.pathname === nextHref) {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                    setOpenMenu(false);
                  };

                  return item.slug === "store-shop" ? (
                    <DropdownMenuItem key={item.slug} asChild className="whitespace-nowrap">
                      <Link to="/productos" preload="intent" onClick={handleClick}>
                        {content}
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={item.slug} asChild className="whitespace-nowrap">
                      <Link
                        to="/$brand/productos"
                        params={{ brand: item.slug }}
                        preload="intent"
                        onClick={handleClick}
                      >
                        {content}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <ConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="¿Cerrar sesión?"
        description="¿Estás seguro de que deseas cerrar sesión?"
        confirmLabel="Sí, cerrar sesión"
        cancelLabel="No"
        onConfirm={async () => {
          await logout();
          await kindeLogout({ redirectUrl: KINDE_LOGOUT_REDIRECT_URI });
          navigate({ to: "/" });
        }}
      />
    </>
  );
}
