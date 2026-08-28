import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ContactRound,
  Facebook,
  Globe,
  Instagram,
  LayoutDashboard,
  Mail,
  MapPin,
  Package,
  Phone,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Settings,
  Store,
  Trash2,
  Heart,
  User,
  Users,
} from "lucide-react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { BrandMark } from "@/components/common/brand-mark";
import {
  getBrandContactPresentation,
  getStoreShopContact,
  getStoreNavigation,
  type BrandConfig,
  type StoreShopContact,
  type StoreShopContactItem,
} from "@/config/brands";

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.9 2.9 0 1 1-2-2.76V9.4a6.35 6.35 0 1 0 5.45 6.27V8.74a8.22 8.22 0 0 0 4.81 1.54V6.86a4.84 4.84 0 0 1-1.04-.17Z" />
    </svg>
  );
}

function TrustpilotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="m12 2.2 2.2 6.76h7.1l-5.75 4.18 2.2 6.76L12 15.72l-5.75 4.18 2.2-6.76L2.7 8.96h7.1L12 2.2Z" />
    </svg>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        fill="#4285F4"
        d="M21.35 12.27c0-.68-.06-1.34-.18-1.97H12v3.73h5.23a4.47 4.47 0 0 1-1.94 2.93v2.44h3.14c1.84-1.7 2.92-4.2 2.92-7.13Z"
      />
      <path
        fill="#34A853"
        d="M12 21.63c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.52A9.75 9.75 0 0 0 12 21.63Z"
      />
      <path
        fill="#FBBC05"
        d="M6.53 13.72A5.86 5.86 0 0 1 6.22 12c0-.6.1-1.18.31-1.72V7.76H3.29A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.04 4.24l3.24-2.52Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.25c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.32 14.63 2.37 12 2.37a9.75 9.75 0 0 0-8.71 5.39l3.24 2.52c.77-2.31 2.93-4.03 5.47-4.03Z"
      />
    </svg>
  );
}

function ContactItem({
  item,
  icon: Icon,
}: {
  item: StoreShopContactItem;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const content = (
    <>
      {item.logo ? (
        <img src={item.logo} alt="" className="size-4 max-h-4 max-w-4 object-contain" />
      ) : (
        <Icon className="size-4" />
      )}
      <span className="whitespace-nowrap">{item.text}</span>
    </>
  );
  return item.href ? (
    <a
      href={item.href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {content}
    </a>
  ) : (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">{content}</span>
  );
}

export function BrandFooter({
  brand,
  storeContact,
  section = "store-shop",
}: {
  brand: BrandConfig;
  storeContact?: StoreShopContact;
  section?: "store-shop" | "brand" | "admin" | "account";
}) {
  const [contactSettings, setContactSettings] = useState(
    () =>
      storeContact ??
      (section === "brand" ? getBrandContactPresentation(brand.slug) : getStoreShopContact()),
  );

  useEffect(() => {
    const readContact = () =>
      storeContact ??
      (section === "brand" ? getBrandContactPresentation(brand.slug) : getStoreShopContact());
    setContactSettings(readContact());
    const syncContact = () => setContactSettings(readContact());
    window.addEventListener("lrg-brand-data-updated", syncContact);
    return () => window.removeEventListener("lrg-brand-data-updated", syncContact);
  }, [brand.slug, section, storeContact]);

  return (
    <KindeAuthGate
      fallback={
        <BrandFooterContent
          brand={brand}
          storeContact={contactSettings}
          section={section}
          auth={null}
        />
      }
    >
      {(auth) => (
        <BrandFooterContent
          brand={brand}
          storeContact={contactSettings}
          section={section}
          auth={auth}
        />
      )}
    </KindeAuthGate>
  );
}

function BrandFooterContent({
  brand,
  storeContact,
  section,
  auth,
}: {
  brand: BrandConfig;
  storeContact: StoreShopContact;
  section: "store-shop" | "brand" | "admin" | "account";
  auth: ReturnType<typeof useKindeAuth> | null;
}) {
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const isAdmin =
    isAuthenticated &&
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("lrg_auth_role") === "admin" &&
    window.sessionStorage.getItem("lrg_admin_final_verified") === "true";
  const categories = section === "brand" ? brand.categories : [];
  const menu = isAdmin
    ? [
        ["Panel administrativo", "/admin/panel", LayoutDashboard],
        ["Productos", "/admin/productos", Package],
        ["Pedidos", "/admin/pedidos", ShoppingCart],
        ["Clientes", "/admin/clientes", Users],
        ["Proveedores", "/admin/proveedores", ContactRound],
        ["Tiendas disponibles", "/admin/marcas", Store],
        ["Configuración", "/admin/configuracion", Settings],
        ["Papelera", "/admin/papelera", Trash2],
      ]
    : isAuthenticated
      ? [
          ["Pedidos", "/cuenta#orders", ShoppingCart],
          ["Perfil", "/cuenta#profile", User],
          ["Direcciones", "/cuenta#addresses", MapPin],
          ["Favoritos", "/cuenta#favorites", Heart],
        ]
      : [];
  const renderLink = (label: string, to: string, Icon?: typeof LayoutDashboard) => (
    <li key={`${label}-${to}`}>
      <Link
        to={to as "/"}
        className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
      >
        {Icon && <Icon className="size-4" />}
        {label}
      </Link>
    </li>
  );

  return (
    <footer className="mt-24 border-t border-border/60 bg-surface/40">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-5">
        {categories.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Categorías</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    to="/$brand/productos"
                    params={{ brand: brand.slug }}
                    search={{ categoria: category.slug }}
                    className="transition-colors hover:text-foreground"
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {isAuthenticated && menu.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold">Mi menú</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {menu.map(([label, to, Icon]) => renderLink(label, to, Icon))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold">Panel</h3>
          {isAuthenticated && (
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {isAdmin ? (
                <li>
                  <Link
                    to="/admin/panel"
                    className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                  >
                    <ShieldCheck className="size-4" /> Administrador
                  </Link>
                </li>
              ) : (
                <li>
                  <Link
                    to="/cuenta"
                    className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                  >
                    <User className="size-4" /> Cliente
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold">Tiendas</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {getStoreNavigation().map((item) => (
              <li key={item.slug}>
                <Link
                  to={item.slug === "store-shop" ? "/" : "/$brand"}
                  params={item.slug === "store-shop" ? undefined : { brand: item.slug }}
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <BrandMark compact brandSlug={item.slug} className="shrink-0" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Contacto</h3>
          <div className="mt-4 flex flex-col items-start gap-2.5">
            <ContactItem item={storeContact.email} icon={Mail} />
            <ContactItem item={storeContact.phone} icon={Phone} />
            <ContactItem item={storeContact.location} icon={MapPin} />
          </div>
          <h3 className="mt-5 text-sm font-semibold">Redes sociales</h3>
          <div className="mt-3 flex flex-col items-start gap-2">
            <ContactItem item={storeContact.socials.instagram} icon={Instagram} />
            <ContactItem item={storeContact.socials.whatsapp} icon={Phone} />
            <ContactItem item={storeContact.socials.tiktok} icon={TikTokIcon} />
            <ContactItem item={storeContact.socials.facebook} icon={Facebook} />
          </div>
          <h3 className="mt-5 text-sm font-semibold">Reseñas</h3>
          <div className="mt-3 flex flex-col items-start gap-2">
            <ContactItem item={storeContact.socials.trustpilot} icon={TrustpilotIcon} />
            <ContactItem item={storeContact.socials.google} icon={GoogleIcon} />
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 py-6">
        <Link
          to="/"
          className="mx-auto block max-w-7xl px-4 text-xs text-muted-foreground transition-colors hover:text-foreground sm:px-6"
        >
          © {new Date().getFullYear()} LRG Store Shop · {brand.name}. Todos los derechos reservados.
        </Link>
      </div>
    </footer>
  );
}
