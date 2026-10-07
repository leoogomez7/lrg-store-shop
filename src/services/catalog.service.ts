import { queryOptions } from "@tanstack/react-query";
import type { BrandSlug } from "@/config/brands";
import { buildProductPublicSlug, type Product } from "@/data/products";
import {
  getProductRecordIdentityFromPublicSlug,
  getProductVariantIdentityFromPublicSlug,
} from "@/lib/product-slug";
import type { Order } from "@/data/orders";
import { products } from "@/data/products";
import { orders } from "@/data/orders";
import {
  listAdminOrders,
  listAdminProductsPage,
  listCatalogProductSummaries,
  getCatalogProductBySlug,
  getRelatedCatalogProducts,
  getCatalogProductImages,
  getCatalogProductCardImages,
  getAdminProductRevision,
  listAdminOrdersWithoutDocuments,
  getAdminOrderById,
  listAdminProductsWithoutImages,
  listAdminOrderSummaries,
  loadAdminSettings,
  upsertAdminOrder,
  completeReservedStockOrder,
} from "@/server/persistence";

async function loadAllAdminProducts(brand?: BrandSlug): Promise<Product[]> {
  const allProducts: Product[] = [];
  let offset = 0;

  while (true) {
    const page = await listAdminProductsPage({
      data: { offset, ...(brand ? { brand } : {}) },
    });
    allProducts.push(...page.products);
    if (page.done) return allProducts;
    if (page.nextOffset <= offset) {
      throw new Error("No se pudo avanzar al cargar las páginas del catálogo.");
    }
    offset = page.nextOffset;
  }
}

/**
 * Capa de servicios. Los componentes nunca acceden a los datos directamente:
 * cuando exista backend, sólo cambia la implementación de estas funciones.
 */
export function expandCatalogProducts(productList: Product[]) {
  const expanded: Product[] = [];

  for (const product of productList) {
    if (product.hidden) continue;

    if (!product.variants?.length) {
      expanded.push({
        ...product,
        slug: buildProductPublicSlug({
          name: product.name,
          id: product.id,
          fallbackSlug: product.slug,
        }),
      });
      continue;
    }

    for (const variant of product.variants) {
      if (variant.hidden) continue;

      expanded.push({
        ...product,
        id: `${product.id}::${variant.id}`,
        parentId: product.id,
        variantId: variant.id,
        variantName: variant.name,
        name: product.name,
        slug: buildProductPublicSlug({
          name: product.name,
          variantName: variant.name,
          id: `${product.id}::${variant.id}`,
          fallbackSlug: product.slug,
        }),
        price: Math.max(0, variant.price * (1 - (variant.discount ?? 0) / 100)),
        compareAtPrice: variant.discount ? variant.price : product.compareAtPrice,
        discount: variant.discount ?? 0,
        priceCurrency: variant.priceCurrency ?? product.priceCurrency ?? "ARS",
        comision: variant.comision ?? product.comision,
        comisionCurrency: variant.comisionCurrency ?? product.comisionCurrency ?? "ARS",
        gastos: variant.gastos ?? product.gastos,
        gastosCurrency: variant.gastosCurrency ?? product.gastosCurrency ?? "ARS",
        supplier: variant.supplier ?? product.supplier,
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

export const catalogService = {
  listCatalogSummaries: async (brand?: BrandSlug) => {
    const summaryProducts = await listCatalogProductSummaries({
      data: brand ? { brand } : {},
    });
    return expandCatalogProducts(summaryProducts);
  },
  listByBrand: async (brand: BrandSlug, loaded?: Product[]) => {
    const productsData = loaded ?? (await loadAllAdminProducts(brand));
    const filtered = productsData.filter((product) => product.brand === brand);
    const flattened = expandCatalogProducts(filtered);
    products.splice(0, products.length, ...productsData);
    return flattened;
  },
  detail: async (brand: BrandSlug, slug: string, loaded?: Product[]) => {
    if (!loaded) return getCatalogProductBySlug({ data: { brand, slug } });

    const productIdentity = getProductRecordIdentityFromPublicSlug(slug);
    const variantIdentity = getProductVariantIdentityFromPublicSlug(slug);
    return (
      loaded.find(
        (product) =>
          product.brand === brand &&
          !product.hidden &&
          (product.slug === slug ||
            (product.id === productIdentity &&
              (!variantIdentity ||
                product.variants?.some((variant) => variant.id === variantIdentity)))),
      ) ?? null
    );
  },
  related: async (brand: BrandSlug, slug: string, loaded?: Product[]) => {
    if (!loaded) {
      const relatedProducts = await getRelatedCatalogProducts({ data: { brand, slug } });
      return expandCatalogProducts(relatedProducts).slice(0, 4);
    }

    const allProducts = loaded;
    const product = allProducts.find((item) => item.brand === brand && item.slug === slug);
    return product
      ? expandCatalogProducts(
          allProducts.filter(
            (item) =>
              item.id !== product.id &&
              item.brand === product.brand &&
              item.category === product.category &&
              !item.hidden,
          ),
        ).slice(0, 4)
      : [];
  },
  listAll: async () => {
    const loaded = await loadAllAdminProducts();
    products.splice(0, products.length, ...loaded);
    return expandCatalogProducts(loaded);
  },
  listAllAdmin: async () => {
    const loaded = await loadAllAdminProducts();
    products.splice(0, products.length, ...loaded);
    return loaded;
  },
  listAllAdminWithoutImages: async () => {
    const loaded = await listAdminProductsWithoutImages({ data: {} });
    products.splice(0, products.length, ...loaded);
    return loaded;
  },
};

export const orderService = {
  list: async () => {
    const loaded = await listAdminOrders();
    orders.splice(0, orders.length, ...loaded);
    return loaded;
  },
  listWithoutDocuments: async () => {
    const loaded = await listAdminOrdersWithoutDocuments({ data: {} });
    orders.splice(0, orders.length, ...loaded);
    return loaded;
  },
  detail: (id: string) => getAdminOrderById({ data: { id } }),
  revenue: async (orders?: Awaited<ReturnType<typeof listAdminOrderSummaries>>) => {
    const dashboardOrders = orders ?? (await listAdminOrderSummaries({ data: {} }));
    const totals = new Map<
      string,
      { month: string; arcade: number; scents: number; webDesign: number }
    >();
    for (const order of dashboardOrders) {
      const date = new Date(order.date);
      const month = date.toLocaleDateString("es-AR", { month: "short" });
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const current = totals.get(key) ?? { month, arcade: 0, scents: 0, webDesign: 0 };
      if (order.brand === "arcade") current.arcade += order.total;
      if (order.brand === "scents") current.scents += order.total;
      if (order.brand === "web-design") current.webDesign += order.total;
      totals.set(key, current);
    }
    return Array.from(totals.values());
  },
  create: async (order: Order, reservationOwnerId: string) => {
    const productsData = await loadAllAdminProducts();
    const orderWithSupplierSnapshots: Order = {
      ...order,
      items: order.items.map((item) => {
        if (item.supplier) return item;
        const product = productsData.find(
          (candidate) => candidate.id === item.productId || candidate.name === item.name,
        );
        const variant = product?.variants?.find(
          (candidate) => candidate.id === item.variantId || candidate.name === item.variantName,
        );
        const supplier = variant?.supplier ?? product?.supplier;
        return supplier
          ? {
              ...item,
              supplier: {
                name: supplier.name,
                phone: supplier.phone,
                social: supplier.social,
              },
            }
          : item;
      }),
    };
    const result = await completeReservedStockOrder({
      data: { ownerId: reservationOwnerId, order: orderWithSupplierSnapshots },
    });
    if (!result.ok) {
      throw new Error(
        result.reason === "out_of_stock"
          ? "El producto se quedó sin stock mientras completabas la compra. Revisá el carrito."
          : "Se venció la prioridad de compra de uno de los productos. Volvé al carrito para reservarlo nuevamente.",
      );
    }
    return orderWithSupplierSnapshots;
  },
  update: async (order: Order) => {
    await upsertAdminOrder({ data: { order } });
    return order;
  },
};

export const catalogQueries = {
  productRevision: () =>
    queryOptions({
      queryKey: ["catalog-revision"],
      queryFn: () => getAdminProductRevision({ data: {} }),
      staleTime: 0,
      retry: false,
    }),
  settings: () =>
    queryOptions({
      queryKey: ["admin-settings"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => loadAdminSettings({ data: {} }),
    }),
  rawByBrand: (brand: BrandSlug) =>
    queryOptions({
      queryKey: ["products", brand, "raw"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => loadAllAdminProducts(brand),
    }),
  catalogSummaries: () =>
    queryOptions({
      queryKey: ["products", "catalog", "summaries", "all"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => catalogService.listCatalogSummaries(),
    }),
  catalogSummariesByBrand: (brand: BrandSlug) =>
    queryOptions({
      queryKey: ["products", "catalog", "summaries", brand],
      staleTime: 5 * 60 * 1000,
      queryFn: () => catalogService.listCatalogSummaries(brand),
    }),
  cardImages: (productIds: string[]) => {
    const normalizedIds = Array.from(new Set(productIds)).sort();
    return queryOptions({
      queryKey: ["products", "card-images", ...normalizedIds],
      staleTime: 5 * 60 * 1000,
      enabled: normalizedIds.length > 0,
      queryFn: async () => {
        const imageRows = await getCatalogProductCardImages({
          data: { productIds: normalizedIds },
        });
        return Object.fromEntries(imageRows.map(({ id, image }) => [id, image]));
      },
    });
  },
  byBrand: (brand: BrandSlug) =>
    queryOptions({
      queryKey: ["products", brand],
      staleTime: 5 * 60 * 1000,
      queryFn: ({ client }) =>
        client
          .ensureQueryData(catalogQueries.rawByBrand(brand))
          .then((loaded) => catalogService.listByBrand(brand, loaded)),
    }),
  detail: (brand: BrandSlug, slug: string) =>
    queryOptions({
      queryKey: ["product", brand, slug],
      staleTime: 5 * 60 * 1000,
      queryFn: () => getCatalogProductBySlug({ data: { brand, slug } }),
    }),
  detailImages: (brand: BrandSlug, slug: string) =>
    queryOptions({
      queryKey: ["product", brand, slug, "images"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => getCatalogProductImages({ data: { brand, slug } }),
    }),
  related: (brand: BrandSlug, slug: string) =>
    queryOptions({
      queryKey: ["product", brand, slug, "related"],
      staleTime: 5 * 60 * 1000,
      queryFn: async () =>
        expandCatalogProducts(await getRelatedCatalogProducts({ data: { brand, slug } })).slice(
          0,
          4,
        ),
    }),
  all: () =>
    queryOptions({
      queryKey: ["products", "all"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => catalogService.listCatalogSummaries(),
    }),
  allAdminSummaries: () =>
    queryOptions({
      queryKey: ["products", "all", "admin-summary"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => catalogService.listAllAdminWithoutImages(),
    }),
  allAdmin: () =>
    queryOptions({
      queryKey: ["products", "all", "admin"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => catalogService.listAllAdmin(),
    }),
};

export const orderQueries = {
  dashboard: () =>
    queryOptions({
      queryKey: ["orders", "dashboard-summary"],
      staleTime: 60 * 1000,
      queryFn: () => listAdminOrderSummaries({ data: {} }),
    }),
  list: () =>
    queryOptions({
      queryKey: ["orders"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => orderService.list(),
    }),
  listWithoutDocuments: () =>
    queryOptions({
      queryKey: ["orders", "without-documents"],
      staleTime: 5 * 60 * 1000,
      queryFn: () => orderService.listWithoutDocuments(),
    }),
  revenue: () =>
    queryOptions({
      queryKey: ["orders", "revenue"],
      staleTime: 5 * 60 * 1000,
      queryFn: ({ client }) =>
        client
          .ensureQueryData(orderQueries.dashboard())
          .then((orders) => orderService.revenue(orders)),
    }),
};

export type { Product, Order };
