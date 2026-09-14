import type { BrandCategory, BrandSubcategory } from "@/config/brands";
import type { SortOption } from "./product-filters";

export const sortLabels: Record<SortOption, string> = {
  "descuento-asc": "Precio: menor a mayor",
  "descuento-desc": "Precio: mayor a menor",
  "nombre-asc": "Nombre: A-Z",
  "nombre-desc": "Nombre: Z-A",
  "agregado-asc": "Producto agregado: Antiguo a nuevo",
  "agregado-desc": "Producto agregado: Nuevo a antiguo",
};

export function mergeBrandCategories(categories: BrandCategory[]): BrandCategory[] {
  const merged = new Map<string, BrandCategory>();

  const mergeSubcategories = (
    current: BrandSubcategory[] = [],
    incoming: BrandSubcategory[] = [],
  ): BrandSubcategory[] => {
    const result = new Map<string, BrandSubcategory>();
    [...current, ...incoming].forEach((subcategory) => {
      const previous = result.get(subcategory.slug);
      result.set(subcategory.slug, {
        ...(previous ?? subcategory),
        ...subcategory,
        ...(previous || subcategory.children
          ? { children: mergeSubcategories(previous?.children, subcategory.children) }
          : {}),
      });
    });
    return Array.from(result.values());
  };

  categories.forEach((category) => {
    const previous = merged.get(category.slug);
    merged.set(category.slug, {
      ...(previous ?? category),
      ...category,
      ...(previous || category.subcategories
        ? {
            subcategories: mergeSubcategories(previous?.subcategories, category.subcategories),
          }
        : {}),
    });
  });

  return Array.from(merged.values());
}

export function getCategoryFilterValues(
  categories: BrandCategory[],
  selectedSlugs: string[],
): Set<string> {
  const descendants = new Map<string, string[]>();

  const collect = (slug: string, children: BrandSubcategory[] = []) => {
    const values = children.flatMap((child) => [
      child.slug,
      ...(child.children ? collect(child.slug, child.children) : []),
    ]);
    descendants.set(slug, values);
    return values;
  };

  categories.forEach((category) => collect(category.slug, category.subcategories));

  return new Set(selectedSlugs.flatMap((slug) => [slug, ...(descendants.get(slug) ?? [])]));
}
