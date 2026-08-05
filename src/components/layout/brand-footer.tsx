import { Link } from "@tanstack/react-router";
import { Banknote, Bitcoin, CreditCard, Currency, Globe, Mail, MapPin, Phone, Instagram, Facebook } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { brandList, type BrandConfig } from "@/config/brands";

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M9 18a3 3 0 1 0 0-6h1v6" />
      <path d="M13 8v6a3 3 0 1 0 3 3V7h-3" />
    </svg>
  );
}

export function BrandFooter({ brand }: { brand: BrandConfig }) {
  return (
    <footer className="mt-24 border-t border-border/60 bg-surface/40">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4">
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 transition-colors hover:text-foreground">
              <BrandMark brandSlug="store-shop" label="LRG Store Shop" />
            </Link>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {brand.footerNote}
          </p>
          <div className="flex flex-wrap gap-2">
            {brand.payments.map((payment) => {
              let Icon = CreditCard;
              let label = payment;
              const lower = payment.toLowerCase();
              if (lower.includes("transfer") || lower.includes("transferencia") || lower.includes("bank")) {
                Icon = Banknote;
                label = "Transferencia bancaria";
              } else if (lower.includes("crypto") || lower.includes("wise")) {
                Icon = Bitcoin;
              } else if (lower.includes("visa") || lower.includes("mastercard") || lower.includes("amex")) {
                Icon = CreditCard;
              } else {
                Icon = Currency;
              }

              return (
                <span
                  key={payment}
                  className="glass inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-[0.7rem] text-muted-foreground"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {label}
                </span>
              );
            })}
          </div>
        </div>

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
          <h3 className="text-sm font-semibold">Ecosistema</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link to="/" className="transition-colors hover:text-foreground">
                LRG Store Shop
              </Link>
            </li>
            {brandList.map((item) => (
              <li key={item.slug}>
                <Link
                  to="/$brand"
                  params={{ brand: item.slug }}
                  className="transition-colors hover:text-foreground"
                >
                  {item.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/cuenta" className="transition-colors hover:text-foreground">
                Mi cuenta
              </Link>
            </li>
            <li>
              <Link to="/admin" className="transition-colors hover:text-foreground">
                Panel administrativo
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Contacto</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <a
                  href={"https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(brand.contact.email)}
                  onClick={(e) => {
                      e.preventDefault();
                      const gmailUrl = "https://mail.google.com/mail/?view=cm&fs=1&to=" + encodeURIComponent(brand.contact.email);
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
                <a href={`tel:${brand.contact.phone}`} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
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
            </ul>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {brand.social.map((social) => {
              const key = social.label.toLowerCase();
              let Icon: any = null;
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
                  className="flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
                  <span className="text-sm text-muted-foreground">{social.label}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 py-6">
        <p className="mx-auto max-w-7xl px-4 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} LRG Store Shop · {brand.name}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
