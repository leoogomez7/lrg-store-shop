import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { catalogService, expandCatalogProducts } from "./catalog.service";

const product = (overrides: Partial<Product> = {}): Product => ({
  id: "product-1",
  slug: "product-1",
  brand: "scents",
  name: "Lataffa Asad",
  category: "Perfumes",
  price: 100,
  stock: 1,
  rating: 0,
  reviews: 0,
  short: "",
  description: "",
  features: [],
  createdAt: "2026-01-01",
  ...overrides,
});

describe("catalog visibility", () => {
  it("excludes hidden products from public catalog results", () => {
    const visible = product();
    const hidden = product({ id: "hidden-product", slug: "hidden-product", hidden: true });

    expect(expandCatalogProducts([visible, hidden]).map((item) => item.id)).toEqual(["product-1"]);
  });

  it("excludes hidden variants while keeping visible variants", () => {
    const parent = product({
      variants: [
        { id: "visible", name: "Visible", price: 100, description: "", stock: 1 },
        { id: "hidden", name: "Hidden", hidden: true, price: 100, description: "", stock: 1 },
      ],
    });

    expect(expandCatalogProducts([parent]).map((item) => item.variantId)).toEqual(["visible"]);
  });

  it("uses the variant sale price and its own stock in public catalog entries", () => {
    const parent = product({
      variants: [
        { id: "offer", name: "Oferta", price: 135_983, discount: 50, description: "", stock: 10 },
      ],
    });

    expect(expandCatalogProducts([parent])[0]).toMatchObject({
      price: 67_991.5,
      compareAtPrice: 135_983,
      stock: 10,
      variantId: "offer",
    });
  });

  it("returns related variants with their individual price and stock", async () => {
    const current = product({ slug: "current" });
    const related = product({
      id: "related-product",
      slug: "related-product",
      variants: [
        { id: "primary", name: "Primario", price: 14_000, description: "", stock: 10 },
        { id: "secondary", name: "Secundario", price: 8_000, description: "", stock: 10 },
      ],
    });

    await expect(catalogService.related("scents", current.slug, [current, related])).resolves.toMatchObject([
      { id: "related-product::primary", price: 14_000, stock: 10 },
      { id: "related-product::secondary", price: 8_000, stock: 10 },
    ]);
  });

  it("does not resolve hidden products through their public detail URL", async () => {
    const hidden = product({ hidden: true });

    await expect(catalogService.detail("scents", hidden.slug, [hidden])).resolves.toBeNull();
  });
});
