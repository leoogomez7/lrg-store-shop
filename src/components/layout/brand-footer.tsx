import { Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { ArrowUpRight, Facebook, Globe, Instagram, Mail, MapPin, Phone } from "lucide-react";
import {
  getBrandContactPresentation,
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
}: {
  brand: BrandConfig;
  storeContact?: StoreShopContact;
}) {
  const contactSettings = storeContact ?? getBrandContactPresentation(brand.slug);
  return (
    <footer className="mt-24 border-t border-border/60 bg-surface/40">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-5">
        <div>
          <h3 className="text-sm font-semibold">Categorías</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {brand.categories.slice(0, 5).map((category) => (
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
          <h3 className="text-sm font-semibold">Panel</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link
                to="/login"
                search={{ role: "client" }}
                className="transition-colors hover:text-foreground"
              >
                Mi cuenta
              </Link>
            </li>
            <li>
              <Link
                to="/login"
                search={{ role: "admin" }}
                className="transition-colors hover:text-foreground"
              >
                Administrador
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Contacto</h3>
          {contactSettings ? (
            <>
              <div className="mt-4 flex flex-col items-start gap-2.5">
                <ContactItem item={contactSettings.email} icon={Mail} />
                <ContactItem item={contactSettings.phone} icon={Phone} />
                <ContactItem item={contactSettings.location} icon={MapPin} />
              </div>
              <div className="mt-2 flex flex-col items-start gap-2">
                <ContactItem item={contactSettings.socials.instagram} icon={Instagram} />
                <ContactItem item={contactSettings.socials.whatsapp} icon={Phone} />
                <ContactItem item={contactSettings.socials.tiktok} icon={TikTokIcon} />
                <ContactItem item={contactSettings.socials.facebook} icon={Facebook} />
                <ContactItem item={contactSettings.socials.review} icon={ArrowUpRight} />
              </div>
            </>
          ) : (
            <>
              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-muted-foreground" />
                  <a
                    href={
                      "https://mail.google.com/mail/?view=cm&fs=1&to=" +
                      encodeURIComponent(brand.contact.email)
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      const gmailUrl =
                        "https://mail.google.com/mail/?view=cm&fs=1&to=" +
                        encodeURIComponent(brand.contact.email);
                      const opened = window.open(gmailUrl, "_blank");
                      if (!opened) {
                        window.location.href = "mailto:" + encodeURIComponent(brand.contact.email);
                      }
                    }}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {brand.contact.email}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-muted-foreground" />
                  <a
                    href={`tel:${brand.contact.phone}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {brand.contact.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" />
                  <a
                    href={
                      "https://www.google.com/maps/search/?api=1&query=" +
                      encodeURIComponent(brand.contact.location)
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {brand.contact.location}
                  </a>
                </li>
                {brand.contact.link && (
                  <li className="flex items-center gap-2">
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                    <a
                      href={brand.contact.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Link
                    </a>
                  </li>
                )}
              </ul>
              <div className="mt-2 flex flex-col items-start gap-2 text-sm">
                {brand.social.map((social) => {
                  const key = social.label.toLowerCase();
                  let Icon: ComponentType<{ className?: string }> | null = null;
                  if (key.includes("instagram")) Icon = Instagram;
                  else if (key.includes("whatsapp")) Icon = Phone;
                  else if (key.includes("tiktok")) Icon = TikTokIcon;
                  else if (key.includes("facebook")) Icon = Facebook;

                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={social.label}
                      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground w-auto self-start"
                    >
                      {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
                      <span>{social.label}</span>
                    </a>
                  );
                })}
                <a
                  href="https://es.trustpilot.com/review/psplusargentinaps4.empretienda.com.ar"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Reseñas"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground w-auto self-start"
                >
                  <span className="">⭐</span>
                  <span>Reseñas</span>
                </a>
              </div>
            </>
          )}
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
