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
  ShoppingCart,
  Settings,
  Store,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M9 18a3 3 0 1 0 0-6h1v6" />
      <path d="M13 8v6a3 3 0 1 0 3 3V7h-3" />
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
      <span>{item.text}</span>
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
  const menu =
    section === "admin"
      ? [
          ["Dashboard", "/admin/panel", LayoutDashboard],
          ["Productos", "/admin/productos", Package],
          ["Pedidos", "/admin/pedidos", ShoppingCart],
          ["Clientes", "/admin/clientes", Users],
          ["Proveedores", "/admin/proveedores", ContactRound],
          ["Tiendas disponibles", "/admin/marcas", Store],
          ["Configuración", "/admin/configuracion", Settings],
          ["Papelera", "/admin/papelera", Trash2],
        ]
      : section === "account"
        ? [
            ["Pedidos", "/cuenta#orders"],
            ["Datos", "/cuenta#profile"],
            ["Dirección", "/cuenta#addresses"],
            ["Favoritos", "/cuenta#favorites"],
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
        {menu.length > 0 && (section === "admin" || section === "account") && (
          <div>
            <h3 className="text-sm font-semibold">Mi menú</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {menu.map(([label, to]) => renderLink(label, to))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold">Panel</h3>
          {isAuthenticated && (
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <Link
                  to="/cuenta"
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <User className="size-4" /> Cliente
                </Link>
              </li>
              {isAdmin && (
                <li>
                  <Link
                    to="/admin/panel"
                    className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                  >
                    <Shield className="size-4" /> Administrador
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
                  className="transition-colors hover:text-foreground"
                >
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
            <ContactItem item={storeContact.socials.trustpilot} icon={ArrowUpRight} />
            <ContactItem item={storeContact.socials.google} icon={Globe} />
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
