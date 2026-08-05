import { SlidersHorizontal, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import { formatPrice } from "@/lib/format";
import type { BrandCategory } from "@/config/brands";

export type SortOption = "relevancia" | "precio-asc" | "precio-desc" | "novedades" | "rating";

export type CatalogFilters = {
  search: string;
  categories: string[];
  maxPrice: number;
  inStockOnly: boolean;
  sort: SortOption;
};

export const sortLabels: Record<SortOption, string> = {
  relevancia: "Relevancia",
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  novedades: "Novedades",
  rating: "Mejor valorados",
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
}: {
  categories: BrandCategory[];
  filters: CatalogFilters;
  priceLimit: number;
  resultCount: number;
  onChange: (next: Partial<CatalogFilters>) => void;
  onReset: () => void;
  hideSearch?: boolean;
  hideSort?: boolean;
}) {
  const activeCount =
    (filters.search ? 1 : 0) +
    filters.categories.length +
    (filters.inStockOnly ? 1 : 0) +
    (filters.maxPrice < priceLimit ? 1 : 0);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const activeCatCount = filters.categories.length;

  return (
    <aside className="glass-panel h-fit space-y-6 rounded-2xl p-5 lg:sticky lg:top-24">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="size-4 text-primary" />
          Filtros
          {activeCount > 0 && <Badge variant="secondary">{activeCount}</Badge>}
        </span>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 px-2 text-xs">
            <X className="mr-1 size-3.5" /> Limpiar
          </Button>
        )}
      </header>

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
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {category.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Precio máximo</Label>
          <span className="text-xs text-muted-foreground">{formatPrice(filters.maxPrice)}</span>
        </div>
        <Slider
          min={0}
          max={priceLimit}
          step={Math.max(1, Math.round(priceLimit / 100))}
          value={[filters.maxPrice]}
          onValueChange={(value) => onChange({ maxPrice: value[0] ?? priceLimit })}
        />
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


      <p className="text-xs text-muted-foreground">{resultCount} productos encontrados</p>
    </aside>
  );
}
