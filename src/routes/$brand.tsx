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
