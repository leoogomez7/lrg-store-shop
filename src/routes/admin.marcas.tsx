import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";
import { brandList } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { catalogQueries } from "@/services/catalog.service";

export const Route = createFileRoute("/admin/marcas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueries.all()),
  head: () => ({
    meta: [
      { title: "Marcas — Admin LRG Store Shop" },
      {
        name: "description",
        content: "Configuración de los tres sectores: identidad, categorías, contacto y pagos.",
      },
      { property: "og:title", content: "Marcas — Admin LRG Store Shop" },
      { property: "og:description", content: "Configuración de marcas del ecosistema LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBrands,
});

function AdminBrands() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Ecosistema</p>
      <h1 className="mt-2 text-3xl font-semibold">Tiendas disponibles</h1>

      <div className="mt-10 grid gap-6 pb-20 lg:grid-cols-3">
        {brandList.map((brand) => {
          const brandProducts = products.filter((product) => product.brand === brand.slug);
          const inventoryValue = brandProducts.reduce(
            (sum, product) => sum + product.price * product.stock,
            0,
          );

          return (
            <article key={brand.slug} className={`${brand.theme} glass-panel rounded-2xl p-6 h-full flex flex-col justify-between`}>
              <div>
                <div className="flex items-start gap-3">
                  <BrandMark compact brandSlug={brand.slug} />
                  <div className="min-h-14">
                    <h2 className="font-display font-semibold">{brand.name}</h2>
                    <p className="text-xs text-primary">{brand.tagline}</p>
                  </div>
                </div>

              <div className="mt-5">
                <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                  Categorías
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brand.categories.map((category) => (
                    <Badge key={category.slug} variant="secondary">
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-1 text-xs text-muted-foreground">
                <p>{brand.contact.email}</p>
                <p>{brand.contact.phone}</p>
                <p>{brand.contact.location}</p>
              </div>
            </div>

              <Button asChild variant="secondary" size="sm" className="mt-6 w-full gap-2">
                <Link to="/$brand" params={{ brand: brand.slug }}>
                  Ir a la tienda <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
