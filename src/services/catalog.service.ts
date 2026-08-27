import { queryOptions } from "@tanstack/react-query";
import type { BrandSlug } from "@/config/brands";
import type { Product } from "@/data/products";
import type { Order } from "@/data/orders";
import { products } from "@/data/products";
import { orders } from "@/data/orders";
import { listAdminOrders, listAdminProducts, upsertAdminOrder } from "@/server/persistence";

/**
 * Capa de servicios. Los componentes nunca acceden a los datos directamente:
 * cuando exista backend, sólo cambia la implementación de estas funciones.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function simulate<T>(value: T, ms = 320): Promise<T> {
  await delay(ms);
  return value;
}

export const catalogService = {
  listByBrand: async (brand: BrandSlug) => {
    const loaded = await listAdminProducts({ data: {} });
    products.splice(0, products.length, ...loaded);
    return simulate(loaded.filter((product) => product.brand === brand));
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
    return simulate(loaded, 200);
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
