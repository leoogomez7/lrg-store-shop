import test from "node:test";
import assert from "node:assert/strict";

import { createProductSaveQueue, type Product } from "./products";

test("queued saves preserve the snapshot at the time of each save", async () => {
  const savedSnapshots: string[] = [];

  const saveQueue = createProductSaveQueue(async (products: Product[]) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    savedSnapshots.push(products[0]?.name ?? "empty");
    return true;
  });

  const firstProducts = [{
    id: "1",
    name: "GTA VI - PS5",
    slug: "gta-vi-ps5",
    brand: "arcade",
    category: "consolas",
    price: 0,
    stock: 0,
    rating: 0,
    reviews: 0,
    short: "",
    description: "",
    features: [],
    createdAt: "2026-01-01",
  } satisfies Product];

  const secondProducts = [{
    id: "1",
    name: "Cyberpunk 2077",
    slug: "cyberpunk-2077",
    brand: "arcade",
    category: "consolas",
    price: 0,
    stock: 0,
    rating: 0,
    reviews: 0,
    short: "",
    description: "",
    features: [],
    createdAt: "2026-01-01",
  } satisfies Product];

  const firstProduct = firstProducts[0]!;
  const firstSave = saveQueue(firstProducts);
  const secondSave = saveQueue(secondProducts);
  firstProduct.name = "mutated-before-second-save";

  await Promise.all([firstSave, secondSave]);

  assert.deepEqual(savedSnapshots, ["GTA VI - PS5", "Cyberpunk 2077"]);
});

test("queued saves rethrow persistence failures so the UI can surface the error", async () => {
  const saveQueue = createProductSaveQueue(async () => {
    throw new Error("persist failed");
  });

  await assert.rejects(() => saveQueue([{ 
    id: "1",
    name: "Product",
    slug: "product",
    brand: "arcade",
    category: "consolas",
    price: 0,
    stock: 0,
    rating: 0,
    reviews: 0,
    short: "",
    description: "",
    features: [],
    createdAt: "2026-01-01",
  } satisfies Product]), /persist failed/);
});
