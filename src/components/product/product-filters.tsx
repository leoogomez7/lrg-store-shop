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
import { brandList } from "@/config/brands";
import type { BrandCategory, BrandSubcategory } from "@/config/brands/types";
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
  deliveryTime?: string[];
  shippingMethod?: string[];
  paymentMethod?: string[];
  priceCurrencies?: CurrencyCode[];
  minPrice: number;
  maxPrice: number;
  inStockOnly: boolean;
  sort: SortOption;
};

function FilterOptionsSection({
  id,
  title,
  value,
  options,
  onChange,
}: {
  id: string;
  title: string;
  value: string[];
  options: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 text-sm font-medium"
        aria-expanded={open}
        aria-controls={id}
      >
        <span>{title}</span>
        {value.length > 0 && <Badge variant="secondary">{value.length}</Badge>}
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div id={id} className="space-y-2.5">
          {["all", ...options].map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-3 text-sm transition-opacity hover:opacity-80"
            >
              <Checkbox
                checked={option === "all" ? value.length === 0 : value.includes(option)}
                onCheckedChange={(checked) => {
                  if (option === "all") {
                    onChange([]);
                    return;
                  }
                  onChange(
                    checked ? [...value, option] : value.filter((selected) => selected !== option),
                  );
                }}
              />
              <span className="font-medium">{option === "all" ? "Todos" : option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

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
  brandFilterLabel = "Sectores",
  deliveryOptions = [],
  shippingOptions = [],
  paymentOptions = [],
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
  brandFilterLabel?: string;
  deliveryOptions?: string[];
  shippingOptions?: string[];
  paymentOptions?: string[];
}) {
  const priceCurrencyFilterActive = filters.priceCurrencies?.length === 1;
  const activeCount =
    (filters.search ? 1 : 0) +
    filters.categories.length +
    (filters.brands?.length ?? 0) +
    (filters.deliveryTime?.length ?? 0) +
    (filters.shippingMethod?.length ?? 0) +
    (filters.paymentMethod?.length ?? 0) +
    (priceCurrencyFilterActive ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.minPrice > 0 ? 1 : 0) +
    (filters.maxPrice < priceLimit ? 1 : 0);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const activeCatCount = filters.categories.length;
  const activeBrandCount = filters.brands?.length ?? 0;
  const activePriceCount = (filters.minPrice > 0 ? 1 : 0) + (filters.maxPrice < priceLimit ? 1 : 0);
  const selectedPriceCurrencies = filters.priceCurrencies?.length
    ? filters.priceCurrencies
    : (["ARS"] as CurrencyCode[]);
  const priceCurrencyLabel =
    selectedPriceCurrencies.length === 2
      ? "$/USD"
      : selectedPriceCurrencies[0] === "USD"
        ? "USD"
        : "$";

  const getDescendantSlugs = (children: BrandSubcategory[] = []): string[] =>
    children.flatMap((child) => [child.slug, ...getDescendantSlugs(child.children)]);

  const getAncestorSlugs = (slug: string): string[] => {
    const ancestors: string[] = [];

    const findPath = (items: BrandCategory[] | BrandSubcategory[], parents: string[]): boolean => {
      for (const item of items) {
        if (item.slug === slug) {
          ancestors.push(...parents);
          return true;
        }
        const children = "children" in item ? item.children : (item as BrandCategory).subcategories;
        if (children?.length && findPath(children, [...parents, item.slug])) return true;
      }
      return false;
    };

    findPath(categories, []);
    return ancestors;
  };

  const toggleCategory = (slug: string, checked: boolean) => {
    const selected = new Set(filters.categories);
    const findDescendants = (items: BrandCategory[] | BrandSubcategory[]): string[] | null => {
      for (const item of items) {
        if (item.slug === slug) {
          const children =
            "children" in item ? item.children : (item as BrandCategory).subcategories;
          return getDescendantSlugs(children);
        }
        const children = "children" in item ? item.children : (item as BrandCategory).subcategories;
        if (children?.length) {
          const result = findDescendants(children);
          if (result !== null) return result;
        }
      }
      return null;
    };
    const descendants = findDescendants(categories) ?? [];
    const branch = [slug, ...descendants];

    if (checked) {
      branch.forEach((value) => selected.add(value));
    } else {
      branch.forEach((value) => selected.delete(value));
      getAncestorSlugs(slug).forEach((value) => selected.delete(value));
    }

    onChange({ categories: Array.from(selected) });
  };

  const renderSubcategory = (subcategory: BrandSubcategory, depth: number) => {
    const checked = filters.categories.includes(subcategory.slug);
    return (
      <div key={subcategory.slug} className="space-y-2">
        <label
          className="flex cursor-pointer items-start gap-3 text-sm transition-opacity hover:opacity-80"
          style={{ paddingLeft: `${depth * 1.25}rem` }}
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => toggleCategory(subcategory.slug, value === true)}
          />
          <span className="font-medium">{subcategory.name}</span>
        </label>
        {subcategory.children?.map((child) => renderSubcategory(child, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="h-fit w-full max-w-full space-y-6 lg:sticky lg:top-24">
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
            <label className="flex cursor-pointer items-start gap-3 text-sm transition-opacity hover:opacity-80">
              <Checkbox
                checked={filters.categories.length === 0}
                onCheckedChange={() => onChange({ categories: [] })}
              />
              <span className="font-semibold">Todos</span>
            </label>
            {categories.map((category) => {
              const checked = filters.categories.includes(category.slug);
              return (
                <div key={category.slug} className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-3 text-sm transition-opacity hover:opacity-80">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => toggleCategory(category.slug, value === true)}
                    />
                    <span className="font-semibold">{category.name}</span>
                  </label>
                  {category.subcategories?.map((subcategory) => renderSubcategory(subcategory, 1))}
                </div>
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
              <span>{brandFilterLabel}</span>
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
              <label className="flex cursor-pointer items-start gap-3 text-sm transition-opacity hover:opacity-80">
                <Checkbox
                  checked={(filters.brands ?? []).length === 0}
                  onCheckedChange={() => onChange({ brands: [] })}
                />
                <span className="font-semibold">Todos</span>
              </label>
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

      {deliveryOptions.length > 0 && (
        <FilterOptionsSection
          id="delivery-time-list"
          title="Tiempo de entrega"
          value={filters.deliveryTime ?? []}
          options={deliveryOptions}
          onChange={(value) => onChange({ deliveryTime: value })}
        />
      )}

      {shippingOptions.length > 0 && (
        <FilterOptionsSection
          id="shipping-method-list"
          title="Método de envío"
          value={filters.shippingMethod ?? []}
          options={shippingOptions}
          onChange={(value) => onChange({ shippingMethod: value })}
        />
      )}

      {paymentOptions.length > 0 && (
        <FilterOptionsSection
          id="payment-method-list"
          title="Método de pago"
          value={filters.paymentMethod ?? []}
          options={paymentOptions}
          onChange={(value) => onChange({ paymentMethod: value })}
        />
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
                    checked={selectedPriceCurrencies.includes(currency)}
                    onCheckedChange={(checked) => {
                      if (!checked && selectedPriceCurrencies.length === 1) return;
                      onChange({
                        priceCurrencies: checked
                          ? Array.from(new Set([...selectedPriceCurrencies, currency]))
                          : selectedPriceCurrencies.filter((value) => value !== currency),
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

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-surface-2/70 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
        <Label
          htmlFor="filter-stock"
          className="cursor-pointer text-sm font-semibold text-foreground"
        >
          Sólo con stock
        </Label>
        <Switch
          id="filter-stock"
          checked={filters.inStockOnly}
          onCheckedChange={(value) => onChange({ inStockOnly: value })}
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground">{resultCount} productos encontrados</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={activeCount === 0}
          className="ml-auto flex h-8 px-2 text-xs"
        >
          <X className="mr-1 size-3.5" /> Limpiar
        </Button>
      </div>
    </aside>
  );
}
