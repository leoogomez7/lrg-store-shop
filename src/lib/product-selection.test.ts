import { describe, expect, it } from "vitest";

import {
  areEquivalentProductSelectionKeys,
  removeSelectionFromQueue,
} from "./product-selection";

describe("product selection matching", () => {
  it("treats a product selection and a variant selection for the same product as equivalent", () => {
    expect(areEquivalentProductSelectionKeys("product-1", "product-1:variant-9")).toBe(true);
    expect(areEquivalentProductSelectionKeys("product-1:variant-9", "product-1")).toBe(true);
  });

  it("keeps different products or different variants distinct", () => {
    expect(areEquivalentProductSelectionKeys("product-1:variant-9", "product-1:variant-10")).toBe(
      false,
    );
    expect(areEquivalentProductSelectionKeys("product-1", "product-2")).toBe(false);
  });

  it("removes all equivalent entries from the bulk queue", () => {
    const queue = ["product-1", "product-1:variant-9", "product-2", "product-1:variant-10"];

    expect(removeSelectionFromQueue(queue, "product-1:variant-9")).toEqual([
      "product-2",
      "product-1:variant-10",
    ]);
    expect(removeSelectionFromQueue(queue, "product-1")).toEqual(["product-2"]);
  });
});
