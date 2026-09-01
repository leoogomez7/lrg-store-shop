import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ContactRound,
  Facebook,
  Instagram,
  LayoutDashboard,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingCart,
  Settings,
  Store,
  Trash2,
  Heart,
  House,
  User,
  UserRound,
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

function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.08 0C5.53 0 .2 5.33.2 11.88c0 2.09.55 4.13 1.59 5.93L.1 24l6.33-1.66a11.86 11.86 0 0 0 5.65 1.44h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.18-1.23-6.16-3.45-8.42ZM12.09 21.7h-.01a9.82 9.82 0 0 1-5.01-1.37l-.36-.21-3.76.99 1-3.67-.23-.38a9.83 9.83 0 0 1-1.51-5.18C2.21 6.47 6.64 2.04 12.09 2.04a9.78 9.78 0 0 1 6.96 2.89 9.8 9.8 0 0 1 2.88 6.97c0 5.45-4.43 9.8-9.84 9.8Zm5.39-7.35c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.57-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.49 1.7.63.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

function TrustpilotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 1.4 14.6 9h7.9l-6.4 4.65 2.45 7.55L12 16.55l-6.55 4.65 2.45-7.55L1.5 9h7.9L12 1.4Zm0 3.9L10.3 10.4H5.7l3.73 2.71-1.43 4.4L12 14.8l4 2.71-1.43-4.4L18.3 10.4h-4.6L12 5.3Z" />
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
  const accountMenu = [
    ["Pedidos", "/cuenta/pedidos", ShoppingCart],
    ["Perfil", "/cuenta/perfil", User],
    ["Direcciones", "/cuenta/direcciones", MapPin],
    ["Favoritos", "/cuenta/favoritos", Heart],
  ];
  const adminMenu = [
    ["Panel administrativo", "/admin/panel", LayoutDashboard],
    ["Productos", "/admin/productos", Package],
    ["Pedidos", "/admin/pedidos", ShoppingCart],
    ["Clientes", "/admin/clientes", Users],
    ["Proveedores", "/admin/proveedores", ContactRound],
    ["Tiendas disponibles", "/admin/marcas", Store],
    ["Configuración", "/admin/configuracion", Settings],
    ["Papelera", "/admin/papelera", Trash2],
  ];
  const menu = isAdmin
    ? adminMenu
    : section === "account"
      ? accountMenu
      : isAuthenticated
        ? accountMenu
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
    <footer className={cn("mt-24 border-t border-border/60 bg-surface/40", section === "account" && "w-full")}> 
      <div className={cn("grid w-full gap-10 py-14 lg:grid-cols-5", section === "account" ? "max-w-none px-0 sm:px-0" : "mx-auto max-w-7xl px-4 sm:px-6") }>
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
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {!isAuthenticated ? (
              <>
                <li>
                  <Link
                    to="/cuenta/panel"
                    className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                  >
                    <UserRound className="size-4" /> Cliente
                  </Link>
                </li>
                <li>
                  <Link
                    to="/admin/panel"
                    className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                  >
                    <ShieldCheck className="size-4" /> Administrador
                  </Link>
                </li>
              </>
            ) : isAdmin ? (
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
                  to="/cuenta/panel"
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <UserRound className="size-4" /> Cliente
                </Link>
              </li>
            )}
          </ul>
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
            <ContactItem item={storeContact.socials.whatsapp} icon={WhatsAppIcon} />
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
      <div className={cn("border-t border-border/60 py-6", section === "account" && "w-full")}>
        <Link
          to="/"
          className={cn(
            "block text-xs text-muted-foreground transition-colors hover:text-foreground",
            section === "account" ? "max-w-none px-0" : "mx-auto max-w-7xl px-4 sm:px-6",
          )}
        >
          © {new Date().getFullYear()} LRG Store Shop · {brand.name}. Todos los derechos reservados.
        </Link>
      </div>
    </footer>
  );
}
