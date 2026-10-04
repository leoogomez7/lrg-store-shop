import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import type { BrandCategory } from "@/config/brands/types";
import {
  filterCategoriesByProducts,
  getCategoryFilterValues,
  matchesProductCategorySelection,
  mergeBrandCategories,
} from "./product-filter-utils";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "ps-plus-product",
  slug: "ps-plus-product",
  brand: "arcade",
  name: "PlayStation Plus",
  category: "juegos-digitales",
  subcategory: "ps5",
  subcategoryPath: ["ps5", "ps-plus"],
  price: 10_000,
  stock: 10,
  rating: 0,
  reviews: 0,
  short: "",
  description: "",
  features: [],
  createdAt: "2026-01-01",
  ...overrides,
});

const categories: BrandCategory[] = [
  {
    slug: "juegos-digitales",
    name: "Juegos digitales",
    description: "",
    subcategories: [
      {
        slug: "ps5",
        name: "PS5",
        children: [{ slug: "ps-plus", name: "PS Plus" }],
      },
    ],
  },
];

describe("nested product categories", () => {
  it("keeps category branches when a product matches a nested path value", () => {
    expect(filterCategoriesByProducts(categories, [product()])).toEqual(categories);
  });

  it("matches a product by its deepest configured category", () => {
    const values = getCategoryFilterValues(categories, ["ps-plus"]);
    expect(matchesProductCategorySelection(product(), values)).toBe(true);
  });

  it("matches legacy product category values stored as display names", () => {
    const values = getCategoryFilterValues(categories, ["ps-plus"]);
    expect(
      matchesProductCategorySelection(
        product({
          category: "Juegos Digitales",
          subcategory: "PlayStation 5",
          subcategoryPath: ["PS5", "PS Plus"],
        }),
        values,
      ),
    ).toBe(true);
  });

  it("keeps distinct categories when their slugs collide after normalization", () => {
    const duplicateCategories: BrandCategory[] = [
      {
        slug: "accesorios",
        name: "Accesorios",
        description: "",
        subcategories: [{ slug: "consolas", name: "Consolas" }],
      },
      {
        slug: "accesorios",
        name: "Accesorios Premium",
        description: "",
        subcategories: [{ slug: "consolas", name: "Consolas Premium" }],
      },
    ];

    expect(mergeBrandCategories(duplicateCategories)).toHaveLength(2);
  });

  it("does not include a product when a different nested leaf is selected", () => {
    const values = getCategoryFilterValues(categories, ["other-leaf"]);
    expect(matchesProductCategorySelection(product(), values)).toBe(false);
  });
});
