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

type ActiveFilterChipsProps = {
  categories: BrandCategory[];
  filters: CatalogFilters;
  priceLimit: number;
  onChange: (next: Partial<CatalogFilters>) => void;
  showBrandFilter?: boolean;
};

export type FilterChipItem = {
  key: string;
  label: string;
  onRemove: () => void;
};

export function FilterChipList({ chips }: { chips: FilterChipItem[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Filtros activos">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-surface-2/70 px-2.5 py-1 text-xs text-foreground"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={`Quitar filtro ${chip.label}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function ActiveFilterChips({
  categories,
  filters,
  priceLimit,
  onChange,
  showBrandFilter = false,
}: ActiveFilterChipsProps) {
  const chips: FilterChipItem[] = [];
  const addChip = (key: string, label: string, onRemove: () => void) =>
    chips.push({ key, label, onRemove });

  const findCategory = (
    items: BrandCategory[] | BrandSubcategory[],
    slug: string,
    parents: string[] = [],
  ): { descendants: string[]; ancestors: string[] } | null => {
    const collectDescendants = (children: BrandSubcategory[] = []): string[] =>
      children.flatMap((child) => [child.slug, ...collectDescendants(child.children)]);

    for (const item of items) {
      const children = "children" in item ? item.children : (item as BrandCategory).subcategories;
      if (item.slug === slug) {
        return { descendants: collectDescendants(children), ancestors: parents };
      }
      if (children?.length) {
        const result = findCategory(children, slug, [...parents, item.slug]);
        if (result) return result;
      }
    }
    return null;
  };

  const removeCategory = (slug: string) => {
    const match = findCategory(categories, slug);
    const excluded = new Set([slug, ...(match?.descendants ?? []), ...(match?.ancestors ?? [])]);
    onChange({ categories: filters.categories.filter((value) => !excluded.has(value)) });
  };

  const categoryNames = new Map<string, string>();
  const collectCategoryNames = (items: BrandCategory[] | BrandSubcategory[]) => {
    items.forEach((item) => {
      categoryNames.set(item.slug, item.name);
      const children = "children" in item ? item.children : (item as BrandCategory).subcategories;
      if (children?.length) collectCategoryNames(children);
    });
  };
  collectCategoryNames(categories);

  filters.categories.forEach((slug) =>
    addChip(`category-${slug}`, categoryNames.get(slug) ?? slug, () => removeCategory(slug)),
  );
  if (showBrandFilter) {
    filters.brands?.forEach((slug) => {
      const brand = brandList.find((item) => item.slug === slug);
      addChip(`brand-${slug}`, brand?.name ?? slug, () =>
        onChange({ brands: (filters.brands ?? []).filter((value) => value !== slug) }),
      );
    });
  }
  filters.deliveryTime?.forEach((value) =>
    addChip(`delivery-${value}`, value, () =>
      onChange({ deliveryTime: (filters.deliveryTime ?? []).filter((item) => item !== value) }),
    ),
  );
  filters.shippingMethod?.forEach((value) =>
    addChip(`shipping-${value}`, value, () =>
      onChange({ shippingMethod: (filters.shippingMethod ?? []).filter((item) => item !== value) }),
    ),
  );
  filters.paymentMethod?.forEach((value) =>
    addChip(`payment-${value}`, value, () =>
      onChange({ paymentMethod: (filters.paymentMethod ?? []).filter((item) => item !== value) }),
    ),
  );
  if (filters.search)
    addChip("search", `Buscar: ${filters.search}`, () => onChange({ search: "" }));
  if (filters.inStockOnly)
    addChip("stock", "Sólo con stock", () => onChange({ inStockOnly: false }));
  if (filters.minPrice > 0)
    addChip("min-price", `Desde ${filters.minPrice}`, () => onChange({ minPrice: 0 }));
  if (filters.maxPrice < priceLimit)
    addChip("max-price", `Hasta ${filters.maxPrice}`, () => onChange({ maxPrice: priceLimit }));
  if (filters.priceCurrencies?.length === 1) {
    const currency = filters.priceCurrencies[0];
    addChip(`currency-${currency}`, currency === "ARS" ? "$ (ARS)" : "USD (Dólar)", () =>
      onChange({ priceCurrencies: ["ARS", "USD"] }),
    );
  }

  return <FilterChipList chips={chips} />;
}

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
                  const nextValue = checked
                    ? [...value, option]
                    : value.filter((selected) => selected !== option);
                  onChange(
                    options.every((availableOption) => nextValue.includes(availableOption))
                      ? []
                      : Array.from(new Set(nextValue)),
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

  const findCategoryNode = (
    slug: string,
  ): { children: BrandSubcategory[]; ancestors: string[] } | null => {
    const findInSubcategories = (
      items: BrandSubcategory[],
      ancestors: string[],
    ): { children: BrandSubcategory[]; ancestors: string[] } | null => {
      for (const item of items) {
        if (item.slug === slug) return { children: item.children ?? [], ancestors };
        const result = findInSubcategories(item.children ?? [], [...ancestors, item.slug]);
        if (result) return result;
      }
      return null;
    };

    for (const category of categories) {
      if (category.slug === slug) {
        return { children: category.subcategories ?? [], ancestors: [] };
      }
      const result = findInSubcategories(category.subcategories ?? [], [category.slug]);
      if (result) return result;
    }
    return null;
  };

  const toggleCategory = (slug: string, checked: boolean) => {
    const selected = new Set(filters.categories);
    const node = findCategoryNode(slug);
    const descendants = getDescendantSlugs(node?.children);
    const branch = [slug, ...descendants];

    if (checked) {
      branch.forEach((value) => selected.add(value));
    } else {
      branch.forEach((value) => selected.delete(value));
      node?.ancestors.forEach((value) => selected.delete(value));
    }

    const updateParents = (items: BrandSubcategory[]) => {
      items.forEach((item) => {
        const children = item.children ?? [];
        if (children.length) {
          updateParents(children);
          if (getDescendantSlugs(children).every((value) => selected.has(value))) {
            selected.add(item.slug);
          } else {
            selected.delete(item.slug);
          }
        }
      });
    };

    categories.forEach((category) => {
      const children = category.subcategories ?? [];
      updateParents(children);
      if (children.length && getDescendantSlugs(children).every((value) => selected.has(value))) {
        selected.add(category.slug);
      } else if (children.length) {
        selected.delete(category.slug);
      }
    });

    onChange({
      categories: categories.every((category) => selected.has(category.slug))
        ? []
        : Array.from(selected),
    });
  };

  const isCategoryChecked = (slug: string, children: BrandSubcategory[] = []): boolean => {
    if (filters.categories.includes(slug)) return true;
    if (!children.length) return false;
    return children.every(
      (child) =>
        isCategoryChecked(child.slug, child.children) && filters.categories.includes(child.slug),
    );
  };

  const renderSubcategory = (subcategory: BrandSubcategory, depth: number) => {
    const checked = isCategoryChecked(subcategory.slug, subcategory.children);
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
              const checked = isCategoryChecked(category.slug, category.subcategories);
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
                      onCheckedChange={(value) => {
                        const current = filters.brands ?? [];
                        const next = value
                          ? [...current, brand.slug]
                          : current.filter((slug) => slug !== brand.slug);
                        onChange({
                          brands: brandList.every((availableBrand) =>
                            next.includes(availableBrand.slug),
                          )
                            ? []
                            : Array.from(new Set(next)),
                        });
                      }}
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
