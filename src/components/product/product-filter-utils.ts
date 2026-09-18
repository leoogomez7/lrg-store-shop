import type { BrandCategory, BrandSubcategory } from "@/config/brands/types";
import type { Product } from "@/data/products";
import type { SortOption } from "./product-filters";

export function formatDeliveryTime(product: Product): string {
  const deliveryUnit = product.deliveryUnit ?? "inmediata";
  const deliveryAmount = product.deliveryAmount ?? 0;

  if (deliveryUnit === "inmediata") return "Entrega inmediata";
  if (deliveryUnit === "horas" && deliveryAmount) {
    return `Entrega en ${deliveryAmount} horas`;
  }
  if (deliveryUnit === "dias" && deliveryAmount) {
    return `Entrega en ${deliveryAmount} días`;
  }
  return "Entrega inmediata";
}

export function buildDeliveryOptions(products: Product[]): string[] {
  const immediate = products.some(
    (product) => (product.deliveryUnit ?? "inmediata") === "inmediata",
  );
  const grouped = new Map<"horas" | "dias", number[]>();

  products.forEach((product) => {
    const unit = product.deliveryUnit;
    const amount = product.deliveryAmount;
    if ((unit === "horas" || unit === "dias") && amount) {
      grouped.set(unit, [...(grouped.get(unit) ?? []), amount]);
    }
  });

  return [
    ...(immediate ? ["Entrega inmediata"] : []),
    ...(["dias", "horas"] as const).flatMap((unit) => {
      const values = Array.from(new Set(grouped.get(unit) ?? [])).sort((a, b) => a - b);
      if (values.length === 0) return [];
      const unitLabel = unit === "dias" ? "días" : "horas";
      const minimum = values[0] ?? 0;
      const maximum = values[values.length - 1] ?? minimum;
      return [
        minimum === maximum
          ? `Entrega en ${minimum} ${unitLabel}`
          : `Entrega entre ${minimum} ${unitLabel} y ${maximum} ${unitLabel}`,
      ];
    }),
  ];
}

export function matchesDeliveryOption(product: Product, option: string): boolean {
  if (option === "Entrega inmediata") return formatDeliveryTime(product) === option;
  const match = option.match(/Entrega entre (\d+) (días|horas) y (\d+) \2/);
  if (match) {
    const unit = match[2] === "días" ? "dias" : "horas";
    const minimum = Number(match[1]);
    const maximum = Number(match[3]);
    return (
      product.deliveryUnit === unit &&
      product.deliveryAmount !== undefined &&
      product.deliveryAmount >= minimum &&
      product.deliveryAmount <= maximum
    );
  }
  return formatDeliveryTime(product) === option;
}

export const sortLabels: Record<SortOption, string> = {
  "precio-asc": "Precio: menor a mayor",
  "precio-desc": "Precio: mayor a menor",
  "descuento-asc": "Precio con descuento: menor a mayor",
  "descuento-desc": "Precio con descuento: mayor a menor",
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

export function filterCategoriesByProducts(
  categories: BrandCategory[],
  products: Product[],
): BrandCategory[] {
  const productValues = new Set(
    products.flatMap((product) => [product.category, product.subcategory].filter(Boolean)),
  );
  const matches = (slug: string) =>
    productValues.has(slug) || productValues.has(slug.replace(/^root-/, ""));

  const filterSubcategories = (items: BrandSubcategory[]): BrandSubcategory[] =>
    items.flatMap((item) => {
      const children = filterSubcategories(item.children ?? []);
      return matches(item.slug) || children.length
        ? [{ ...item, ...(children.length ? { children } : {}) }]
        : [];
    });

  return categories.flatMap((category) => {
    const subcategories = filterSubcategories(category.subcategories ?? []);
    return matches(category.slug) || subcategories.length
      ? [{ ...category, ...(subcategories.length ? { subcategories } : {}) }]
      : [];
  });
}

export function getCategoryFilterValues(
  categories: BrandCategory[],
  selectedSlugs: string[],
): Set<string> {
  const descendants = new Map<string, string[]>();
  const aliases = (slug: string) => [slug, slug.replace(/^root-/, "")];

  const collect = (slug: string, children: BrandSubcategory[] = []): string[] => {
    const values = children.flatMap((child) => [
      child.slug,
      ...collect(child.slug, child.children ?? []),
    ]);
    descendants.set(
      slug,
      values.flatMap((value) => aliases(value)),
    );
    return values;
  };

  categories.forEach((category) => collect(category.slug, category.subcategories));

  return new Set(
    selectedSlugs.flatMap((slug) => [...aliases(slug), ...(descendants.get(slug) ?? [])]),
  );
}
