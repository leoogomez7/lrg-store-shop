import { Funnel, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import { formatPrice } from "@/lib/format";
import { brandList, type BrandCategory } from "@/config/brands";
import type { CurrencyCode } from "@/data/products";

export type SortOption =
  | "precio-asc"
  | "precio-desc"
  | "nombre-asc"
  | "nombre-desc"
  | "agregado-asc"
  | "agregado-desc"
  | "descuento-asc"
  | "descuento-desc";

export type CatalogFilters = {
  search: string;
  categories: string[];
  brands?: string[];
  priceCurrencies?: CurrencyCode[];
  minPrice: number;
  maxPrice: number;
  inStockOnly: boolean;
  sort: SortOption;
};

export const sortLabels: Record<SortOption, string> = {
  "descuento-asc": "Precio: menor a mayor",
  "descuento-desc": "Precio: mayor a menor",
  "nombre-asc": "Nombre: A-Z",
  "nombre-desc": "Nombre: Z-A",
  "agregado-asc": "Producto agregado: Antiguo a nuevo",
  "agregado-desc": "Producto agregado: Nuevo a antiguo",
};

/** Único componente de filtros para todas las marcas. */
export function ProductFilters({
  categories,
  filters,
  priceLimit,
  resultCount,
  onChange,
  onReset,
  hideSearch,
  hideSort,
  showBrandFilter = false,
}: {
  categories: BrandCategory[];
  filters: CatalogFilters;
  priceLimit: number;
  resultCount: number;
  onChange: (next: Partial<CatalogFilters>) => void;
  onReset: () => void;
  hideSearch?: boolean;
  hideSort?: boolean;
  showBrandFilter?: boolean;
}) {
  const activeCount =
    (filters.search ? 1 : 0) +
    filters.categories.length +
    (filters.brands?.length ?? 0) +
    (filters.priceCurrencies?.length ?? 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.minPrice > 0 ? 1 : 0) +
    (filters.maxPrice < priceLimit ? 1 : 0);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const activeCatCount = filters.categories.length;
  const activeBrandCount = filters.brands?.length ?? 0;
  const activePriceCount = (filters.minPrice > 0 ? 1 : 0) + (filters.maxPrice < priceLimit ? 1 : 0);
  const priceCurrencyLabel =
    filters.priceCurrencies?.length === 2
      ? "$/USD"
      : filters.priceCurrencies?.[0] === "USD"
        ? "USD"
        : "$";

  return (
    <aside className="glass-panel h-fit w-fit max-w-full space-y-6 rounded-2xl p-5 lg:sticky lg:top-24">
      {!hideSearch && (
        <div className="space-y-2">
          <Label htmlFor="filter-search">Buscar</Label>
          <Input
            id="filter-search"
            placeholder="Nombre o descripción"
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCategoriesOpen((s) => !s)}
            className="flex items-center gap-2 text-sm font-medium"
            aria-expanded={categoriesOpen}
            aria-controls="categories-list"
          >
            <span>Categorías</span>
            {activeCatCount > 0 && <Badge variant="secondary">{activeCatCount}</Badge>}
            {categoriesOpen ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {categoriesOpen && (
          <div id="categories-list" className="space-y-2.5">
            {categories.map((category) => {
              const checked = filters.categories.includes(category.slug);
              return (
                <label
                  key={category.slug}
                  className="flex cursor-pointer items-start gap-3 text-sm transition-opacity hover:opacity-80"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      onChange({
                        categories: value
                          ? [...filters.categories, category.slug]
                          : filters.categories.filter((slug) => slug !== category.slug),
                      })
                    }
                  />
                  <span>
                    <span className="block leading-none font-medium">{category.name}</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {showBrandFilter && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setBrandsOpen((s) => !s)}
              className="flex items-center gap-2 text-sm font-medium"
              aria-expanded={brandsOpen}
              aria-controls="brands-list"
            >
              <span>Sectores</span>
              {activeBrandCount > 0 && <Badge variant="secondary">{activeBrandCount}</Badge>}
              {brandsOpen ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </button>
          </div>

          {brandsOpen && (
            <div id="brands-list" className="space-y-2.5">
              {brandList.map((brand) => {
                const checked = (filters.brands ?? []).includes(brand.slug);
                return (
                  <label
                    key={brand.slug}
                    className="flex cursor-pointer items-start gap-3 text-sm transition-opacity hover:opacity-80"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        onChange({
                          brands: value
                            ? [...(filters.brands ?? []), brand.slug]
                            : (filters.brands ?? []).filter((slug) => slug !== brand.slug),
                        })
                      }
                    />
                    <span>
                      <span className="block leading-none font-medium">{brand.name}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setPriceOpen((s) => !s)}
          className="flex items-center gap-2 text-sm font-medium"
          aria-expanded={priceOpen}
          aria-controls="price-list"
        >
          <span>Precio</span>
          {activePriceCount > 0 && <Badge variant="secondary">{activePriceCount}</Badge>}
          {priceOpen ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>

        {priceOpen && (
          <div id="price-list" className="space-y-3">
            <div className="space-y-2.5">
              {(["ARS", "USD"] as const).map((currency) => (
                <label key={currency} className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={filters.priceCurrencies?.includes(currency) ?? false}
                    onCheckedChange={(checked) => {
                      const selected = filters.priceCurrencies ?? [];
                      onChange({
                        priceCurrencies: checked
                          ? [...selected, currency]
                          : selected.filter((value) => value !== currency),
                      });
                    }}
                  />
                  <span className="font-medium">
                    {currency === "ARS" ? "$ (ARS)" : "USD (Dólar)"}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-foreground/90">
              <label className="flex shrink-0 items-center gap-2">
                <span>Desde {priceCurrencyLabel}</span>
                <Input
                  aria-label={`Precio mínimo en ${priceCurrencyLabel}`}
                  type="number"
                  min={0}
                  max={priceLimit}
                  value={filters.minPrice}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    onChange({ minPrice: Math.min(Math.max(0, value), filters.maxPrice) });
                  }}
                  className="h-8 w-20 px-2 sm:w-24"
                />
              </label>
              <label className="flex shrink-0 items-center justify-end gap-2">
                <span>Hasta {priceCurrencyLabel}</span>
                <Input
                  aria-label={`Precio máximo en ${priceCurrencyLabel}`}
                  type="number"
                  min={0}
                  max={priceLimit}
                  value={filters.maxPrice}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (!Number.isFinite(value)) return;
                    onChange({ maxPrice: Math.max(Math.min(priceLimit, value), filters.minPrice) });
                  }}
                  className="h-8 w-20 px-2 sm:w-24"
                />
              </label>
            </div>
            <Slider
              min={0}
              max={priceLimit}
              step={Math.max(1, Math.round(priceLimit / 100))}
              value={[filters.minPrice, filters.maxPrice]}
              onValueChange={(value) => {
                const nextMin = value[0] ?? 0;
                const nextMax = value[1] ?? priceLimit;
                onChange({
                  minPrice: Math.min(nextMin, nextMax),
                  maxPrice: Math.max(nextMin, nextMax),
                });
              }}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
        <Label htmlFor="filter-stock" className="cursor-pointer text-sm">
          Sólo con stock
        </Label>
        <Switch
          id="filter-stock"
          checked={filters.inStockOnly}
          onCheckedChange={(value) => onChange({ inStockOnly: value })}
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-0">
        <p className="text-xs text-muted-foreground">{resultCount} productos encontrados</p>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="ml-auto flex h-8 px-2 text-xs"
          >
            <X className="mr-1 size-3.5" /> Limpiar
          </Button>
        )}
      </div>
    </aside>
  );
}
