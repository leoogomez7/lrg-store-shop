import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { brandList, type BrandConfig } from "@/config/brands";

export function BrandFooter({ brand }: { brand: BrandConfig }) {
  return (
    <footer className="mt-24 border-t border-border/60 bg-surface/40">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4">
        <div className="space-y-4">
          <BrandMark />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {brand.footerNote}
          </p>
          <div className="flex flex-wrap gap-2">
            {brand.payments.map((payment) => (
              <span
                key={payment}
                className="glass rounded-md px-2.5 py-1 text-[0.7rem] text-muted-foreground"
              >
                {payment}
              </span>
            ))}
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
              <Mail className="size-4 text-primary" /> {brand.contact.email}
            </li>
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-primary" /> {brand.contact.phone}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" /> {brand.contact.location}
            </li>
          </ul>
          <div className="mt-4 flex gap-3 text-sm">
            {brand.social.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {social.label}
              </a>
            ))}
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
