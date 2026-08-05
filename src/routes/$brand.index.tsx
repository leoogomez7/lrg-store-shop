import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Star, Truck } from "lucide-react";
import { Reveal } from "@/components/common/motion-primitives";
import { SectionHeading } from "@/components/common/section-heading";
import { ProductCard } from "@/components/product/product-card";
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
    const title = brand ? `${brand.name} — ${brand.tagline}` : "LRG Store Shop";
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
    };
  },
  component: BrandHome,
});

function BrandHome() {
  const params = Route.useParams();
  const brand = getBrand(params.brand)!;
  const { data: products } = useSuspenseQuery(catalogQueries.byBrand(brand.slug));

  const featured = products.filter((product) => product.badge).slice(0, 4);
  const newest = [...products]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  return (
    <main>
      <section className="mx-auto w-full max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs tracking-[0.16em] text-muted-foreground uppercase">
              <Sparkles className="size-3.5 text-primary" />
              {brand.hero.eyebrow}
            </span>
            <h1 className="mt-6 text-4xl leading-[1.05] font-semibold sm:text-6xl">
              {brand.hero.title}{" "}
              <span className="text-gradient-brand">{brand.hero.highlight}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              {brand.hero.subtitle}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/$brand/productos" params={{ brand: brand.slug }}>
                  {brand.hero.primaryCta} <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to="/sectores">{brand.hero.secondaryCta}</Link>
              </Button>
            </div>
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-4">
              {brand.hero.stats.map((stat) => (
                <div key={stat.label} className="glass-panel rounded-xl p-4">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="font-display mt-1 text-xl font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Reveal className="relative">
            <div className="glass-panel relative overflow-hidden rounded-3xl p-6">
              <span className="gradient-brand absolute inset-x-0 top-0 h-1" />
              <div className="grid gap-4 sm:grid-cols-2">
                {featured.slice(0, 2).map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface-2/60 p-4 text-sm">
                <Truck className="size-4 text-primary" />
                <span className="text-muted-foreground">
                  Envíos a todo el país y soporte dedicado por sector.
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {brand.highlights.map((highlight, index) => (
            <Reveal key={highlight.title} delay={index * 0.06}>
              <div className="glass-panel h-full rounded-2xl p-6">
                <span className="gradient-brand grid size-10 place-items-center rounded-xl">
                  <highlight.icon className="size-4 text-primary-foreground" />
                </span>
                <h3 className="font-display mt-4 font-semibold">{highlight.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {highlight.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading
          eyebrow="Categorías"
          title="Explorá por categoría"
          description="Cada categoría está pensada para el público de este sector."
        />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brand.categories.map((category, index) => (
            <Reveal key={category.slug} delay={index * 0.05}>
              <Link
                to="/$brand/productos"
                params={{ brand: brand.slug }}
                search={{ categoria: category.slug }}
                className="glass-panel hover-lift group flex h-full flex-col rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold">{category.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {category.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm text-primary">
                  Ver productos
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
        <SectionHeading
          eyebrow="Destacados"
          title="Lo más elegido"
          description="Selección curada según ventas y valoraciones de la comunidad."
          action={
            <Button asChild variant="secondary">
              <Link to="/$brand/productos" params={{ brand: brand.slug }}>
                Ver todo el catálogo
              </Link>
            </Button>
          }
        />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
        <SectionHeading eyebrow="Novedades" title="Recién llegados" />
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {newest.map((product, index) => (
            <ProductCard key={product.id} product={product} index={index} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
        <div className="glass-panel relative overflow-hidden rounded-3xl p-10 text-center">
          <span className="gradient-brand absolute inset-x-0 top-0 h-1" />
          <Star className="mx-auto size-6 text-primary" />
          <h2 className="font-display mt-4 text-2xl font-semibold sm:text-3xl">
            {brand.shortName} para clientes exigentes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{brand.footerNote}</p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/$brand/productos" params={{ brand: brand.slug }}>
              Empezar a comprar
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
