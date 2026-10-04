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

  it("does not resolve hidden products through their public detail URL", async () => {
    const hidden = product({ hidden: true });

    await expect(catalogService.detail("scents", hidden.slug, [hidden])).resolves.toBeNull();
  });
});
