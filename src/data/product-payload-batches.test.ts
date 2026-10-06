import { describe, expect, it } from "vitest";
import { splitProductsIntoPayloadBatches } from "./products";

describe("splitProductsIntoPayloadBatches", () => {
  it("splits imported products by serialized payload size without losing or reordering them", () => {
    const products = [
      { id: "first", image: "x".repeat(20) },
      { id: "second", image: "y".repeat(20) },
      { id: "third", image: "z".repeat(20) },
    ];
    const batchSize = new TextEncoder().encode(JSON.stringify([products[0], products[1]])).byteLength;

    const batches = splitProductsIntoPayloadBatches(products, batchSize);

    expect(batches).toEqual([[products[0], products[1]], [products[2]]]);
    expect(batches.flat()).toEqual(products);
  });

  it("rejects an individual product that exceeds the request size limit", () => {
    expect(() => splitProductsIntoPayloadBatches([{ image: "x".repeat(100) }], 10)).toThrow(
      "Un producto individual supera el tamaño máximo permitido para importarlo.",
    );
  });

  it("splits at the existing 500-product database batch limit", () => {
    const products = Array.from({ length: 501 }, (_, index) => ({ id: String(index) }));

    const batches = splitProductsIntoPayloadBatches(products, 1_000_000);

    expect(batches.map((batch) => batch.length)).toEqual([500, 1]);
  });
});