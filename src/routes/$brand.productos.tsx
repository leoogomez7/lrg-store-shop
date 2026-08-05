import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { sortLabels } from "@/components/product/product-filters";
import { ProductCard } from "@/components/product/product-card";
import {
  ProductFilters,
  type CatalogFilters,
} from "@/components/product/product-filters";
import { getBrand } from "@/config/brands";
import { catalogQueries } from "@/services/catalog.service";
import { orders } from "@/data/orders";

const searchSchema = z.object({
  categoria: z.string().optional(),
});

export const Route = createFileRoute("/$brand/productos")({
  validateSearch: searchSchema,
  loader: async ({ params, context }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    await context.queryClient.ensureQueryData(catalogQueries.byBrand(brand.slug));
    return { brandSlug: brand.slug };
  },
  head: ({ params }) => {
    const brand = getBrand(params.brand);
    const title = brand ? `Catálogo de ${brand.name}` : "Catálogo — LRG Store Shop";
    const description = brand
      ? `Explorá el catálogo completo de ${brand.name}: ${brand.keywords.join(", ")}.`
      : "Catálogo del ecosistema LRG Store Shop.";
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
  component: CatalogPage,
});

function CatalogPage() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const brand = getBrand(params.brand)!;
  const { data: products } = useSuspenseQuery(catalogQueries.byBrand(brand.slug));

  const priceLimit = useMemo(
    () => Math.ceil(Math.max(...products.map((product) => product.price)) / 50) * 50,
    [products],
  );

  const [filters, setFilters] = useState<CatalogFilters>({
    search: "",
    categories: search.categoria ? [search.categoria] : [],
    maxPrice: priceLimit,
    inStockOnly: false,
    sort: "relevancia",
  });

  const [showFilters, setShowFilters] = useState(false);

  const results = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (query && !`${product.name} ${product.short}`.toLowerCase().includes(query)) return false;
      if (filters.categories.length && !filters.categories.includes(product.category)) return false;
      if (product.price > filters.maxPrice) return false;
      if (filters.inStockOnly && product.stock <= 0) return false;
      return true;
    });

    switch (filters.sort) {
      case "precio-asc":
        return filtered.sort((a, b) => a.price - b.price);
      case "precio-desc":
        return filtered.sort((a, b) => b.price - a.price);
      case "novedades":
        return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case "rating":
        return filtered.sort((a, b) => b.rating - a.rating);
      default:
        return filtered.sort((a, b) => b.reviews - a.reviews);
    }
  }, [products, filters]);

  const topSeller = useMemo(() => {
    const salesCount = orders
      .filter((order) => order.brand === brand.slug)
      .flatMap((order) => order.items)
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.name] = (acc[item.name] ?? 0) + item.quantity;
        return acc;
      }, {});

    const topProductName = Object.entries(salesCount).sort(([, a], [, b]) => b - a)[0]?.[0];
    if (!topProductName) return null;

    const topProduct = products.find((product) => product.name === topProductName);
    return topProduct ? { product: topProduct, sales: salesCount[topProductName] } : null;
  }, [brand.slug, orders, products]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{brand.name}</h1>
        <p className="mt-3 text-muted-foreground">{brand.description}</p>
      </header>

      <div className="mt-6 flex items-center justify-end gap-3">
        <Input
          placeholder="Buscar"
          value={filters.search}
          onChange={(e: any) => setFilters((c) => ({ ...c, search: e.target.value }))}
          className="max-w-md"
        />

        <Select
          value={filters.sort}
          onValueChange={(value) => setFilters((c) => ({ ...c, sort: value as any }))}
        >
          <SelectTrigger className="max-w-xs">
            <div className="flex items-center gap-2">
              <span className="text-sm">Ordenar por</span>
            </div>
            <SelectValue className="sr-only" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(sortLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-2"
        >
          <SlidersHorizontal className="size-4 text-primary" />
          <span>Filtros</span>
        </button>
      </div>

      <div className="mt-10 grid gap-8">
        {topSeller && (
          <div className="glass-panel rounded-3xl p-5 text-sm shadow-sm">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Más vendido</p>
            <div className="mt-3 flex flex-col gap-1">
              <p className="font-semibold">{topSeller.product.name}</p>
              <p className="text-muted-foreground">{topSeller.sales} productos vendidos</p>
            </div>
          </div>
        )}
      </div>

      <div
        className={
          "mt-6 grid gap-8 " + (showFilters ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-1")
        }
      >
        {showFilters && (
          <ProductFilters
            categories={brand.categories}
            filters={filters}
            priceLimit={priceLimit}
            resultCount={results.length}
            onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
            onReset={() =>
              setFilters({
                search: "",
                categories: [],
                maxPrice: priceLimit,
                inStockOnly: false,
                sort: "relevancia",
              })
            }
            hideSearch
          />
        )}

        <section>
          {results.length === 0 ? (
            <div className="glass-panel rounded-2xl p-12 text-center">
              <h2 className="font-display text-lg font-semibold">Sin resultados</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Probá ajustando los filtros o ampliando el rango de precio.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
