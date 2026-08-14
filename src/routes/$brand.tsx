import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { BrandHeader } from "@/components/layout/brand-header";
import { BrandFooter } from "@/components/layout/brand-footer";
import { getBrand } from "@/config/brands";

export const Route = createFileRoute("/$brand")({
  loader: ({ params }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    return { brandSlug: brand.slug };
  },
  head: ({ params }) => {
    const brand = getBrand(params.brand);
    const title = brand ? `${brand.name} — ${brand.tagline}` : "LRG Store Shop";
    const description = brand?.description ?? "Ecosistema de marcas LRG Store Shop.";
    const iconHref = brand?.favicon ?? "/LRG Store Shop PNG.png";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "icon", href: iconHref, type: "image/png" },
        { rel: "shortcut icon", href: iconHref, type: "image/png" },
        { rel: "apple-touch-icon", href: iconHref },
      ],
    };
  },
  component: BrandLayout,
});

function BrandLayout() {
  const params = Route.useParams();
  const brand = getBrand(params.brand);
  if (!brand) return null;

  return (
    <div className={`${brand.theme} min-h-screen bg-background text-foreground`}>
      <div className="aurora-bg" />
      <div className="relative">
        <BrandHeader brand={brand} headerTheme="theme-webdesign" />
        <Outlet />
        <BrandFooter brand={brand} />
      </div>
    </div>
  );
}
