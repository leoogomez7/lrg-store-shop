import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ArrowUpDown, Funnel, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { sortLabels } from "@/components/product/product-filters";
import { ProductCard } from "@/components/product/product-card";
import { ProductFilters, type CatalogFilters } from "@/components/product/product-filters";
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
    const title = brand?.name ?? "LRG Store Shop";
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
      links: [
        {
          rel: "icon",
          href: brand?.favicon ?? "/LRG Store Shop PNG.png",
          type: "image/png",
        },
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
  const [priceCurrencies, setPriceCurrencies] = useState<("ARS" | "USD")[]>(["ARS", "USD"]);

  const priceLimit = useMemo(
    () =>
      Math.max(
        50,
        Math.ceil(
          Math.max(
            ...products
              .filter(
                (product) =>
                  !priceCurrencies.length ||
                  priceCurrencies.includes(product.priceCurrency ?? "ARS"),
              )
              .map((product) => product.price),
            0,
          ) / 50,
        ) * 50,
      ),
    [products, priceCurrencies],
  );

  const [filters, setFilters] = useState<CatalogFilters>({
    search: "",
    categories: search.categoria ? [search.categoria] : [],
    priceCurrencies,
    minPrice: 0,
    maxPrice: priceLimit,
    inStockOnly: false,
    sort: "agregado-asc",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFilters((current) => ({ ...current, minPrice: 0, maxPrice: priceLimit }));
  }, [priceLimit]);

  useEffect(() => {
    if (!showSortOptions) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!sortMenuRef.current?.contains(target)) {
        setShowSortOptions(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showSortOptions]);

  const results = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    const filtered = products.filter((product) => {
      if (query && !`${product.name} ${product.short}`.toLowerCase().includes(query)) return false;
      if (filters.categories.length && !filters.categories.includes(product.category)) return false;
      if (
        filters.priceCurrencies?.length &&
        !filters.priceCurrencies.includes(product.priceCurrency ?? "ARS")
      )
        return false;
      if (product.price < filters.minPrice) return false;
      if (product.price > filters.maxPrice) return false;
      if (filters.inStockOnly && product.stock <= 0) return false;
      return true;
    });

    switch (filters.sort) {
      case "precio-asc":
        return filtered.sort((a, b) => a.price - b.price);
      case "precio-desc":
        return filtered.sort((a, b) => b.price - a.price);
      case "nombre-asc":
        return filtered.sort((a, b) => a.name.localeCompare(b.name));
      case "nombre-desc":
        return filtered.sort((a, b) => b.name.localeCompare(a.name));
      case "agregado-asc":
        return filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case "agregado-desc":
        return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case "descuento-asc":
        return filtered.sort((a, b) => a.price - b.price);
      case "descuento-desc":
        return filtered.sort((a, b) => b.price - a.price);
      default:
        return filtered.sort((a, b) => a.price - b.price);
    }
  }, [products, filters]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{brand.name}</h1>
        <p className="mt-3 text-muted-foreground">{brand.description}</p>
      </header>

      <div className="mt-6 flex items-center justify-end gap-3">
        <div className="relative max-w-md w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto"
            value={filters.search}
            onChange={(e: any) => setFilters((c) => ({ ...c, search: e.target.value }))}
            className="max-w-md pl-9"
          />
        </div>

        <div ref={sortMenuRef} className="relative max-w-xs">
          <button
            type="button"
            onClick={() => setShowSortOptions((value) => !value)}
            className="inline-flex h-9 w-full max-w-xs items-center justify-between gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.16)] transition-colors hover:bg-surface-2/60"
          >
            <span className="flex items-center gap-2">
              <ArrowUpDown className="size-4 text-white" aria-hidden="true" />
              <span>Ordenar por</span>
            </span>
          </button>

          {showSortOptions && (
            <div className="absolute right-0 z-20 mt-2 w-full min-w-55 rounded-xl border border-border/60 bg-background/95 p-2 shadow-lg backdrop-blur-sm">
              {Object.entries(sortLabels).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setFilters((current) => ({
                      ...current,
                      sort: value as CatalogFilters["sort"],
                    }));
                    setShowSortOptions(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                    filters.sort === value
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <span>{label}</span>
                  {filters.sort === value && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowFilters((s) => !s)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.16)] transition-colors hover:bg-surface-2/60"
        >
          <Funnel className="size-4 text-white" />
          <span>Filtros</span>
        </button>
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
            onChange={(next) => {
              if ("priceCurrencies" in next) setPriceCurrencies(next.priceCurrencies ?? []);
              setFilters((current) => ({ ...current, ...next }));
            }}
            onReset={() => {
              setPriceCurrencies(["ARS", "USD"]);
              setFilters({
                search: "",
                categories: [],
                priceCurrencies: ["ARS", "USD"],
                minPrice: 0,
                maxPrice: priceLimit,
                inStockOnly: false,
                sort: "precio-asc",
              });
            }}
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
            <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-12 2xl:grid-cols-16">
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
