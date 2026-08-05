import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Menu, ShoppingBag, User } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/common/brand-mark";
import { CartSheet } from "@/components/layout/cart-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/lib/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { brandList, type BrandConfig } from "@/config/brands";
import { cn } from "@/lib/utils";
import { useCart } from "@/store/cart";

export function BrandHeader({ brand }: { brand: BrandConfig }) {
  const [openMenu, setOpenMenu] = useState(false);
  const { count } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setUserName(window.sessionStorage.getItem("userName"));

    const onStorage = (e: StorageEvent) => {
      if (e.key === "userName") setUserName(window.sessionStorage.getItem("userName"));
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
    { label: "Inicio", to: "/$brand", exact: true },
    { label: "Catálogo", to: "/$brand/productos", exact: false },
  ] as const;

  function UserBadge() {
    const [name, setName] = useState<string | null>(null);
    const [panel, setPanel] = useState<string | null>(null);

    useEffect(() => {
      try {
        const n = sessionStorage.getItem("userName");
        const p = sessionStorage.getItem("activePanel");
        setName(n);
        setPanel(p);
      } catch (e) {
        setName(null);
        setPanel(null);
      }
    }, [pathname]);

    if (!panel) return null;

    const roleLabel = panel === "admin" ? "Administrador" : "Cliente";
    const displayName = name || (panel === "admin" ? "Administrador" : "Usuario");

    return (
      <div className="flex items-center gap-2">
        <div className="px-2 py-1 rounded-md bg-green-50 text-green-800 text-sm font-medium">{displayName}</div>
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

            <span className="mx-2 h-5 w-px bg-border" />

            {brandList
              .filter((item) => item.slug !== brand.slug)
              .map((item) => (
                <a
                  key={item.slug}
                  href={`/${item.slug}`}
                  onClick={handleBrandClick(item.slug)}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.name}
                </a>
              ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <nav className="hidden sm:flex items-center gap-3">
              <Link
                to="/cuenta"
                aria-label="Mi cuenta"
                onClick={() => {
                  try {
                    sessionStorage.setItem("activePanel", "client");
                    if (!sessionStorage.getItem("userName")) sessionStorage.setItem("userName", "Usuario");
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="text-sm font-medium px-2 py-1 rounded hover:bg-surface-2"
              >
                Mi cuenta
              </Link>

              <Link
                to="/admin"
                aria-label="Panel administrativo"
                onClick={() => {
                  try {
                    sessionStorage.setItem("activePanel", "admin");
                    if (!sessionStorage.getItem("userName")) sessionStorage.setItem("userName", "Administrador");
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="text-sm font-medium px-2 py-1 rounded hover:bg-surface-2"
              >
                Panel administrativo
              </Link>
            </nav>

            <div className="hidden sm:flex items-center">
              <UserBadge />
            </div>

            {userName && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
                onClick={async () => {
                  await logout();
                  navigate({ to: "/" });
                }}
              >
                Cerrar sesión
              </Button>
            )}

            <CartSheet brand={brand}>
              <Button variant="secondary" size="sm" className="relative gap-2">
                <ShoppingBag className="size-4" />
                <span className="hidden sm:inline">Carrito</span>
                {count > 0 && (
                  <Badge className="absolute -top-2 -right-2 size-5 justify-center rounded-full p-0 text-[0.65rem]">
                    {count}
                  </Badge>
                )}
              </Button>
            </CartSheet>

            <Sheet open={openMenu} onOpenChange={setOpenMenu}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menú">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>

              <SheetContent side="left" className="w-[86vw] max-w-sm">
                <div className="space-y-6 p-6">
                  <div className="flex items-center gap-3">
                    <BrandMark compact brandSlug={brand.slug} />
                    <div>
                      <div className="font-display text-sm font-semibold tracking-tight">{brand.name}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {links
                      .filter((l) => l.label !== "Inicio")
                      .map((link) => (
                        <Link
                          key={link.label}
                          to={link.to}
                          params={{ brand: brand.slug }}
                          onClick={() => setOpenMenu(false)}
                          className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2"
                        >
                          {link.label}
                        </Link>
                      ))}

                    <Link
                      to="/cuenta"
                      onClick={() => {
                        setOpenMenu(false);
                        try {
                          sessionStorage.setItem("activePanel", "client");
                          if (!sessionStorage.getItem("userName")) sessionStorage.setItem("userName", "Usuario");
                        } catch (e) {
                          /* ignore */
                        }
                      }}
                      className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2"
                    >
                      Mi cuenta
                    </Link>
                  </div>

                  <div className="space-y-1 border-t border-border pt-4">
                    <p className="px-3 pb-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">Sectores</p>
                    {brandList.map((item) => (
                      <a
                        key={item.slug}
                        href={`/${item.slug}`}
                        onClick={handleBrandClick(item.slug, true)}
                        className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2"
                      >
                        {item.name}
                      </a>
                    ))}

                    <div className="border-t border-border mt-4 pt-3">
                      <p className="px-3 pb-2 text-xs tracking-[0.16em] text-muted-foreground uppercase">LRG Store Shop</p>
                      <a
                        href="/"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenMenu(false);
                          if (typeof window !== "undefined" && window.location.pathname === "/") {
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          } else {
                            navigate({ to: "/" });
                          }
                        }}
                        className="block rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2"
                      >
                        Inicio
                      </a>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <div className="h-16" aria-hidden />
    </>
  );
}
