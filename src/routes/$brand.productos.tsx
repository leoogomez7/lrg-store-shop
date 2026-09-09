import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ArrowUpDown, Check, Funnel, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sortLabels } from "@/components/product/product-filters";
import { ProductCard } from "@/components/product/product-card";
import { ProductFilters, type CatalogFilters } from "@/components/product/product-filters";
import { getBrand } from "@/config/brands";
import { catalogQueries } from "@/services/catalog.service";
import { orders } from "@/data/orders";

const searchSchema = z.object({
  categoria: z.string().optional(),
  subcategoria: z.string().optional(),
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

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageSizeInput, setPageSizeInput] = useState<string>("10");

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

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const hasPreviousPage = page > 0;
  const hasNextPage = page + 1 < totalPages;
  const paginatedResults = results.slice(page * pageSize, page * pageSize + pageSize);

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

  useEffect(() => {
    if (page >= totalPages) {
      setPage(Math.max(totalPages - 1, 0));
    }
  }, [page, totalPages]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-14 pt-28 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{brand.name}</h1>
        <p className="mt-3 text-muted-foreground">{brand.description}</p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-start gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar producto"
            value={filters.search}
            onChange={(e: any) => setFilters((c) => ({ ...c, search: e.target.value }))}
            className="max-w-md pl-9"
          />
        </div>

        <Dialog open={showSortOptions} onOpenChange={setShowSortOptions}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.16)] transition-colors hover:bg-surface-2/60"
            >
              <span className="flex items-center gap-2">
                <ArrowUpDown className="size-4 text-white" aria-hidden="true" />
                <span>Ordenar por</span>
              </span>
            </button>
          </DialogTrigger>

          <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
            <DialogHeader className="space-y-2">
              <DialogTitle>Ordenar por</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 pt-2">
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
          </DialogContent>
        </Dialog>

        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_18px_rgba(0,0,0,0.16)] transition-colors hover:bg-surface-2/60"
            >
              <Funnel className="size-4 text-white" />
              <span>Filtros</span>
            </button>
          </DialogTrigger>

          <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
            <DialogHeader className="space-y-2">
              <DialogTitle>Filtros</DialogTitle>
            </DialogHeader>
            <div className="pt-2">
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
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <section className="mt-8">
        {results.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <h2 className="font-display text-lg font-semibold">Sin resultados</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Probá ajustando los filtros o ampliando el rango de precio.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {paginatedResults.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </section>

      {results.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage(0)}
              disabled={!hasPreviousPage}
              className="h-9 rounded-xl border border-input bg-[#111827] px-4 text-sm text-white shadow-none hover:bg-[#1f2937] disabled:opacity-60"
            >
              Principio
            </button>
            <div className="flex items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`h-9 min-w-9 rounded-xl border border-input px-3 py-1.5 text-sm outline-none transition-colors focus-visible:outline-none ${index === page ? "bg-[#111827] text-white shadow-none" : "bg-transparent text-muted-foreground hover:bg-surface-2"}`}
                  onClick={() => setPage(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPage(totalPages - 1)}
              disabled={!hasNextPage}
              className="h-9 rounded-xl border border-input bg-[#111827] px-4 text-sm text-white shadow-none hover:bg-[#1f2937] disabled:opacity-60"
            >
              Último
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="text-sm text-muted-foreground">Mostrar</div>
            <Input
              type="number"
              min={1}
              max={1000}
              value={pageSizeInput}
              placeholder="Cantidad"
              onChange={(e) => setPageSizeInput(e.target.value)}
              className="h-8 w-20 bg-background/50"
            />
            {(() => {
              const v = Number(pageSizeInput);
              const isValid = Number.isFinite(v) && v >= 1;
              const isChanged = pageSizeInput !== "" && String(Math.floor(v)) !== String(pageSize);
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (!isValid || !isChanged) return;
                    const final = Math.min(1000, Math.floor(v));
                    setPageSize(final);
                    setPageSizeInput(String(final));
                    setPage(0);
                  }}
                  disabled={!isValid || !isChanged}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-input bg-[#111827] px-4 text-sm font-medium text-white shadow-none transition-colors hover:bg-[#1f2937] disabled:opacity-60"
                >
                  <Check className="h-4 w-4" />
                  Confirmar
                </button>
              );
            })()}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {paginatedResults.length} de {results.length} productos mostrados
          </p>
        </div>
      )}
    </main>
  );
}
