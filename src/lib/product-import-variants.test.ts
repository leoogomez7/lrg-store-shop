import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { buildImportedProductsWithVariants } from "./product-import-variants";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "fifa-23",
  slug: "fifa-23",
  brand: "arcade",
  name: "FIFA 23 - PS4",
  category: "juegos-digitales",
  subcategory: "ps4",
  subcategoryPath: ["ps4"],
  price: 14_000,
  comision: 14_000,
  stock: 10,
  rating: 0,
  reviews: 0,
  short: "",
  description: "Producto base intacto",
  features: [],
  createdAt: "2026-01-01",
  ...overrides,
});

describe("import products as variants", () => {
  it("adds the imported row as a new variant without replacing parent data", () => {
    const existing = product();
    const imported = product({
      id: "fifa-23-secondary-import",
      slug: "fifa-23-secondary-import",
      price: 8_000,
      comision: 8_000,
      stock: 4,
      description: "Datos propios de la secundaria",
    });

    const result = buildImportedProductsWithVariants([existing], [imported], {
      [imported.id]: { targetProductId: existing.id, variantName: "Secundaria" },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: existing.id,
      price: 14_000,
      description: "Producto base intacto",
      variants: [
        {
          name: "Secundaria",
          price: 8_000,
          stock: 4,
          description: "Datos propios de la secundaria",
        },
      ],
    });
    expect(existing.variants).toBeUndefined();
  });

  it("can add multiple variants to one parent and leave other imports independent", () => {
    const existing = product();
    const firstVariant = product({ id: "import-primary", price: 20_000, stock: 2 });
    const secondVariant = product({ id: "import-secondary", price: 30_000, stock: 5 });
    const independent = product({ id: "independent", name: "Otro producto" });

    const result = buildImportedProductsWithVariants(
      [existing],
      [firstVariant, secondVariant, independent],
      {
        [firstVariant.id]: { targetProductId: existing.id, variantName: "Primaria" },
        [secondVariant.id]: { targetProductId: existing.id, variantName: "Secundaria" },
      },
    );

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.id === existing.id)?.variants?.map((variant) => variant.name)).toEqual([
      "Primaria",
      "Secundaria",
    ]);
    expect(result.find((item) => item.id === "independent")?.name).toBe("Otro producto");
  });

  it("rejects an empty or duplicate variant name instead of overwriting", () => {
    const existing = product({
      variants: [{ id: "primary", name: "Primaria", price: 14_000, description: "", stock: 10 }],
    });
    const imported = product({ id: "imported" });

    expect(() =>
      buildImportedProductsWithVariants([existing], [imported], {
        [imported.id]: { targetProductId: existing.id, variantName: "" },
      }),
    ).toThrow("Ingresá el nombre de la variante");

    expect(() =>
      buildImportedProductsWithVariants([existing], [imported], {
        [imported.id]: { targetProductId: existing.id, variantName: "Primaria" },
      }),
    ).toThrow("ya tiene una variante llamada");
  });
});
