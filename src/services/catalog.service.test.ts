import { describe, expect, it } from "vitest";
import type { Product } from "@/data/products";
import { buildProductPublicSlug, productMatchesSearch } from "@/data/products";
import { getProductIdentityFromPublicSlug } from "@/lib/product-slug";
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
  it("searches compact catalog metadata without requiring full product details", () => {
    const summary = product({
      description: "",
      features: [],
      searchText: "EA Sports FC 27 PS4 arcade",
    });

    expect(productMatchesSearch(summary, "fc 27")).toBe(true);
    expect(productMatchesSearch(summary, "xbox")).toBe(false);
  });

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

  it("keeps duplicated products with copied variant IDs on distinct public URLs", () => {
    const sharedVariant = {
      id: "copied-variant-id",
      name: "PS4",
      price: 100,
      description: "",
      stock: 1,
    };
    const originals = [
      product({ id: "original-product", variants: [sharedVariant] }),
      product({ id: "duplicated-product", variants: [sharedVariant] }),
    ];
    const expanded = expandCatalogProducts(originals);

    expect(expanded[0]?.slug).not.toBe(expanded[1]?.slug);
    expect(getProductIdentityFromPublicSlug(expanded[0]!.slug)).toBe(
      "original-product::copied-variant-id",
    );
    expect(getProductIdentityFromPublicSlug(expanded[1]!.slug)).toBe(
      "duplicated-product::copied-variant-id",
    );
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

    await expect(
      catalogService.related("scents", current.slug, [current, related]),
    ).resolves.toMatchObject([
      { id: "related-product::primary", price: 14_000, stock: 10 },
      { id: "related-product::secondary", price: 8_000, stock: 10 },
    ]);
  });

  it("does not resolve hidden products through their public detail URL", async () => {
    const hidden = product({ hidden: true });

    await expect(catalogService.detail("scents", hidden.slug, [hidden])).resolves.toBeNull();
  });

  it("resolves a generated variant URL to its parent product", async () => {
    const parent = product({
      id: "parent-1790358417278",
      slug: "gta-vi-copy-1790358417278",
      variants: [
        { id: "variant-1790885486901-j9xz6", name: "PS4", price: 100, description: "", stock: 1 },
      ],
    });
    const variantSlug = buildProductPublicSlug({
      name: "EA Sports FC 27",
      variantName: "PS4",
      id: `${parent.id}::${parent.variants![0]!.id}`,
    });

    await expect(catalogService.detail("scents", variantSlug, [parent])).resolves.toMatchObject({
      id: parent.id,
      slug: parent.slug,
    });
  });

  it("builds a readable and unique public slug from the product and variant names", () => {
    const identity = "variant-1790885486901-j9xz6";
    const slug = buildProductPublicSlug({
      name: "EA Sports FC 27",
      variantName: "PS4",
      id: identity,
    });

    expect(slug).toContain("ea-sports-fc-27");
    expect(slug).toContain("ps4");
    expect(slug).toMatch(/-\d+$/);
    expect(getProductIdentityFromPublicSlug(slug)).toBe(identity);
    expect(slug).not.toContain("copy-");
    expect(
      buildProductPublicSlug({ name: "EA Sports FC 27", variantName: "PS4", id: `${identity}-2` }),
    ).not.toBe(slug);
  });

  it("keeps the numeric identity suffix intact for long product names", () => {
    const identity = "product-1790358417278";
    const slug = buildProductPublicSlug({
      name: "A very long product title that should never truncate the unique identifier",
      id: identity,
    });

    expect(getProductIdentityFromPublicSlug(slug)).toBe(identity);
  });
});
