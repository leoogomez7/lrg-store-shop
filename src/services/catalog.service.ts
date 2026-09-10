import { queryOptions } from "@tanstack/react-query";
import type { BrandSlug } from "@/config/brands";
import type { Product } from "@/data/products";
import type { Order } from "@/data/orders";
import { products } from "@/data/products";
import { orders } from "@/data/orders";
import {
  listAdminOrders,
  listAdminProducts,
  saveAdminProducts,
  upsertAdminOrder,
} from "@/server/persistence";

/**
 * Capa de servicios. Los componentes nunca acceden a los datos directamente:
 * cuando exista backend, sólo cambia la implementación de estas funciones.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulate<T>(value: T, ms = 320): Promise<T> {
  await delay(ms);
  return value;
}

export function expandCatalogProducts(productList: Product[]) {
  const expanded: Product[] = [];

  for (const product of productList) {
    if (!product.variants?.length) {
      expanded.push(product);
      continue;
    }

    for (const variant of product.variants) {
      expanded.push({
        ...product,
        id: `${product.id}::${variant.id}`,
        parentId: product.id,
        variantId: variant.id,
        variantName: variant.name,
        name: `${product.name}${variant.name ? ` · ${variant.name}` : ""}`,
        price: variant.price,
        priceCurrency: variant.priceCurrency ?? product.priceCurrency ?? "ARS",
        comision: variant.comision ?? product.comision,
        comisionCurrency: variant.comisionCurrency ?? product.comisionCurrency ?? "ARS",
        gastos: variant.gastos ?? product.gastos,
        gastosCurrency: variant.gastosCurrency ?? product.gastosCurrency ?? "ARS",
        description: variant.description || product.description,
        stock: variant.stock,
        stockUnlimited: variant.stockUnlimited ?? product.stockUnlimited ?? false,
        features: variant.features?.length ? variant.features : product.features,
        includes: variant.includes ?? product.includes ?? [],
        cardCommission: variant.cardCommission ?? product.cardCommission,
        image: product.images?.[0],
        images: product.images ?? [],
      });
    }
  }

  return expanded;
}

export async function adjustProductStockForOrder(order: Order, direction: 1 | -1) {
  if (!order.items.length) return;

  const productsData = await listAdminProducts({ data: {} });
  const nextProducts = productsData.map((product) => {
    for (const item of order.items) {
      const itemProductId = item.productId ?? undefined;
      const matchesBaseProduct = itemProductId ? itemProductId === product.id : false;

      if (item.variantId) {
        const variant = product.variants?.find((entry) => entry.id === item.variantId);
        if (matchesBaseProduct && variant && !variant.stockUnlimited) {
          variant.stock = Math.max(0, variant.stock + direction * item.quantity);
        }
        continue;
      }

      if (matchesBaseProduct && !product.stockUnlimited) {
        product.stock = Math.max(0, product.stock + direction * item.quantity);
      }
    }

    if (!product.variants?.length) return product;

    for (const item of order.items) {
      if (!item.variantId) continue;
      const productMatchesVariantParent = item.productId === product.id;
      if (!productMatchesVariantParent) continue;
      const variant = product.variants.find((entry) => entry.id === item.variantId);
      if (!variant || variant.stockUnlimited) continue;
      variant.stock = Math.max(0, variant.stock + direction * item.quantity);
    }

    return product;
  });

  await saveAdminProducts({ data: { products: nextProducts } });
}

export const catalogService = {
  listByBrand: async (brand: BrandSlug) => {
    const loaded = await listAdminProducts({ data: {} });
    const filtered = loaded.filter((product) => product.brand === brand);
    const flattened = expandCatalogProducts(filtered);
    products.splice(0, products.length, ...loaded);
    return simulate(flattened);
  },
  detail: async (brand: BrandSlug, slug: string) =>
    simulate(
      (await listAdminProducts({ data: {} })).find(
        (product) => product.brand === brand && product.slug === slug,
      ) ?? null,
      260,
    ),
  related: async (brand: BrandSlug, slug: string) => {
    const allProducts = await listAdminProducts({ data: {} });
    const product = allProducts.find((item) => item.brand === brand && item.slug === slug);
    return simulate(
      product
        ? allProducts
            .filter(
              (item) =>
                item.id !== product.id &&
                item.brand === product.brand &&
                item.category === product.category,
            )
            .slice(0, 4)
        : [],
      260,
    );
  },
  listAll: async () => {
    const loaded = await listAdminProducts({ data: {} });
    products.splice(0, products.length, ...loaded);
    return simulate(expandCatalogProducts(loaded), 200);
  },
};

export const orderService = {
  list: async () => {
    const loaded = await listAdminOrders();
    orders.splice(0, orders.length, ...loaded);
    return simulate(loaded, 240);
  },
  revenue: async () => {
    const orders = await listAdminOrders();
    const totals = new Map<
      string,
      { month: string; arcade: number; scents: number; webDesign: number }
    >();
    for (const order of orders) {
      const date = new Date(order.date);
      const month = date.toLocaleDateString("es-AR", { month: "short" });
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const current = totals.get(key) ?? { month, arcade: 0, scents: 0, webDesign: 0 };
      if (order.brand === "arcade") current.arcade += order.total;
      if (order.brand === "scents") current.scents += order.total;
      if (order.brand === "web-design") current.webDesign += order.total;
      totals.set(key, current);
    }
    return simulate(Array.from(totals.values()), 200);
  },
  create: async (order: Order) => {
    await adjustProductStockForOrder(order, -1);
    await upsertAdminOrder({ data: { order } });
    return simulate(order, 240);
  },
};

export const catalogQueries = {
  byBrand: (brand: BrandSlug) =>
    queryOptions({
      queryKey: ["products", brand],
      queryFn: () => catalogService.listByBrand(brand),
    }),
  detail: (brand: BrandSlug, slug: string) =>
    queryOptions({
      queryKey: ["product", brand, slug],
      queryFn: () => catalogService.detail(brand, slug),
    }),
  related: (brand: BrandSlug, slug: string) =>
    queryOptions({
      queryKey: ["product", brand, slug, "related"],
      queryFn: () => catalogService.related(brand, slug),
    }),
  all: () =>
    queryOptions({
      queryKey: ["products", "all"],
      queryFn: () => catalogService.listAll(),
    }),
};

export const orderQueries = {
  list: () =>
    queryOptions({
      queryKey: ["orders"],
      queryFn: () => orderService.list(),
    }),
  revenue: () =>
    queryOptions({
      queryKey: ["orders", "revenue"],
      queryFn: () => orderService.revenue(),
    }),
};

export type { Product, Order };
