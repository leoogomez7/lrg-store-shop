import { describe, expect, it } from "vitest";
import { createServerFn } from "@tanstack/react-start";
import { filterAdminProductsBySearch, type Product } from "@/data/products";

describe("TanStack Start server API", () => {
  it("exposes the server function factory used by the application", () => {
    expect(createServerFn).toEqual(expect.any(Function));
  });

  it("does not match a stale variant name after the product was renamed", () => {
    const herConfession = {
      id: "her",
      name: "Lattafa Her Confession",
      brand: "scents",
      category: "perfumes",
      price: 0,
      stock: 0,
      rating: 0,
      reviews: 0,
      short: "",
      description: "",
      features: [],
      createdAt: "2026-01-01",
      variants: [
        { id: "old", name: "Lattafa His Confession", price: 0, description: "", stock: 0 },
      ],
    } as Product;
    const hisConfession = {
      ...herConfession,
      id: "his",
      name: "Lattafa His Confession",
      variants: [],
    };

    expect(filterAdminProductsBySearch([herConfession, hisConfession], "his")).toEqual([
      hisConfession,
    ]);
    expect(filterAdminProductsBySearch([herConfession], "his")).toEqual([]);
  });
});
