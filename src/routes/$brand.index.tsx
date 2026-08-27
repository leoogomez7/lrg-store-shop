import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBrand } from "@/config/brands";
import { catalogQueries } from "@/services/catalog.service";

export const Route = createFileRoute("/$brand/")({
  loader: async ({ params, context }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    await context.queryClient.ensureQueryData(catalogQueries.byBrand(brand.slug));
    return { brandSlug: brand.slug };
  },
  head: ({ params }) => {
    const brand = getBrand(params.brand);
    const title = brand?.name ?? "LRG Store Shop";
    const description = brand?.description ?? "Ecosistema de marcas LRG Store Shop.";
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
        {
          rel: "icon",
          href: brand?.favicon ?? "/favicon.ico",
          type: "image/png",
        },
      ],
    };
  },
  component: BrandHome,
});

function BrandHome() {
  const params = Route.useParams();
  const brand = getBrand(params.brand)!;
  const { data: products } = useSuspenseQuery(catalogQueries.byBrand(brand.slug));

  const defaultCategory = brand.categories[0]?.slug ?? "";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-16 sm:px-6 lg:pt-24">
      <section className="overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_auto] lg:items-center p-8">
          <div>
            <p className="text-xs tracking-[0.24em] text-muted-foreground uppercase">
              {brand.hero.eyebrow}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              {brand.hero.title} <span className="text-gradient-brand">{brand.hero.highlight}</span>
            </h1>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {brand.categories.map((category) => (
                <Link
                  key={category.slug}
                  to="/$brand/productos"
                  params={{ brand: brand.slug }}
                  search={{ categoria: category.slug }}
                  className="group flex min-h-18 flex-col items-center justify-center rounded-3xl border border-border/60 bg-surface px-3 py-3 text-center text-sm text-foreground shadow-sm transition hover:bg-surface-2"
                >
                  <span className="block w-full text-sm font-semibold leading-tight text-foreground transition-colors group-hover:text-foreground">
                    {category.name}
                  </span>
                  <span className="mt-1.5 block w-full text-xs leading-relaxed text-muted-foreground">
                    {category.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-start lg:justify-end">
            <Button asChild size="lg" className="rounded-3xl px-8 py-4">
              <Link to="/$brand/productos" params={{ brand: brand.slug }}>
                Comprar <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
