import { queryOptions } from "@tanstack/react-query";
import type { BrandSlug } from "@/config/brands";
import {
  getProduct,
  getProductsByBrand,
  getRelatedProducts,
  products,
  type Product,
} from "@/data/products";
import { orders, revenueByMonth, type Order } from "@/data/orders";

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
  listByBrand: (brand: BrandSlug) => simulate(getProductsByBrand(brand)),
  detail: (brand: BrandSlug, slug: string) => simulate(getProduct(brand, slug) ?? null, 260),
  related: (brand: BrandSlug, slug: string) => {
    const product = getProduct(brand, slug);
    return simulate(product ? getRelatedProducts(product) : [], 260);
  },
  listAll: () => simulate(products, 200),
};

export const orderService = {
  list: () => simulate(orders, 240),
  revenue: () => simulate(revenueByMonth, 200),
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
