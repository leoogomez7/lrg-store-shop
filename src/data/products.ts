import type { BrandSlug } from "@/config/brands";
import { saveAdminProduct, saveAdminProductBatch, saveAdminProducts } from "@/server/persistence";

const NON_TEXT_CONTENT_KEYS = new Set(["dataurl", "snapshotdata", "image", "images"]);

export function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

export function toSearchableText(value: unknown) {
  const values: string[] = [];
  const visited = new WeakSet<object>();

  const collect = (current: unknown) => {
    if (current === null || current === undefined) return;
    if (
      typeof current === "string" ||
      typeof current === "number" ||
      typeof current === "boolean"
    ) {
      values.push(String(current));
      return;
    }
    if (typeof current !== "object" || visited.has(current)) return;

    visited.add(current);
    if (Array.isArray(current)) {
      current.forEach(collect);
      return;
    }

    Object.entries(current).forEach(([key, nestedValue]) => {
      if (!NON_TEXT_CONTENT_KEYS.has(key.toLocaleLowerCase())) collect(nestedValue);
    });
  };

  collect(value);
  return values.join(" ");
}

const cloneSnapshot = <T>(items: T[]) =>
  typeof structuredClone === "function"
    ? structuredClone(items)
    : JSON.parse(JSON.stringify(items));

export function createProductSaveQueue<T>(persist: (items: T[]) => Promise<unknown>) {
  let pending: Promise<unknown> = Promise.resolve();

  return (items: T[]) => {
    const snapshot = cloneSnapshot(items);
    const savePromise = pending.then(() => persist(snapshot));

    pending = savePromise.catch(() => undefined);

    return savePromise.finally(() => {
      // preserve the original rejection for callers while allowing the queue to continue serially
    });
  };
}

const productSaveQueue = createProductSaveQueue(async (products: Product[]) => {
  return saveAdminProducts({ data: { products } });
});

export async function saveProduct(product: Product) {
  return saveAdminProduct({ data: { product } });
}

export async function saveProductBatch(products: Product[]) {
  const batchSize = 500;
  for (let offset = 0; offset < products.length; offset += batchSize) {
    const saved = await saveAdminProductBatch({
      data: { products: products.slice(offset, offset + batchSize) },
    });
    if (!saved) return false;
  }
  return true;
}

export function saveProducts(products: Product[]) {
  return productSaveQueue(products);
}

export type CurrencyCode = "ARS" | "USD";

export type ProductVariant = {
  id: string;
  name: string;
  hidden?: boolean;
  price: number;
  priceCurrency?: CurrencyCode;
  comision?: number;
  comisionCurrency?: CurrencyCode;
  cardCommission?: boolean;
  gastos?: number;
  gastosCurrency?: CurrencyCode;
  description: string;
  stock: number;
  stockUnlimited?: boolean;
  features?: string[];
  includes?: string[];
  deliveryUnit?: "inmediata" | "horas" | "dias";
  deliveryAmount?: number;
  discount?: number;
  supplier?: ProductSupplier;
};

export type ProductSupplier = {
  name: string;
  phone: string;
  social: string;
  references?: string;
  purchaseDate: string;
};

export type Product = {
  id: string;
  parentId?: string;
  variantId?: string;
  slug: string;
  brand: BrandSlug;
  /** When true the product should be hidden from public listings */
  hidden?: boolean;
  name: string;
  /** Código interno de referencia usado por el administrador. */
  code?: string;
  category: string;
  subcategory?: string;
  /** Ruta de slugs desde la primera subcategoría hasta el nivel más profundo. */
  subcategoryPath?: string[];
  variantName?: string;
  image?: string;
  price: number;
  priceCurrency?: CurrencyCode;
  comision?: number;
  comisionCurrency?: CurrencyCode;
  cardCommission?: boolean;
  variants?: ProductVariant[];
  supplier?: ProductSupplier;
  gastos?: number;
  gastosCurrency?: CurrencyCode;
  usdRate?: number;
  compareAtPrice?: number;
  discount?: number;
  stock: number;
  stockUnlimited?: boolean;
  rating: number;
  reviews: number;
  badge?: string;
  short: string;
  description: string;
  features: string[];
  includes?: string[];
  images?: string[];
  deliveryUnit?: "inmediata" | "horas" | "dias";
  deliveryAmount?: number;
  createdAt: string;
};

export const products: Product[] = [];

export function productMatchesSearch(product: Product, query: string) {
  const normalizedQuery = normalizeSearchText(query.trim());
  if (!normalizedQuery) return true;
  return normalizeSearchText(toSearchableText(product)).includes(normalizedQuery);
}

function productNameMatchesSearch(product: Product, query: string) {
  const queryTerms = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
  if (!queryTerms.length) return true;

  const nameWords = normalizeSearchText(product.name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  return queryTerms.every((term) => nameWords.some((word) => word.startsWith(term)));
}

/** Search only the product's current visible name, never stale variant metadata. */
export function filterAdminProductsBySearch(products: Product[], query: string) {
  const queryTerms = normalizeSearchText(query).trim().split(/\s+/).filter(Boolean);
  if (!queryTerms.length) return products;

  return products.filter((product) => productNameMatchesSearch(product, query));
}

export function productSearchText(product: Product) {
  return toSearchableText(product);
}

export function getProductsByBrand(brand: BrandSlug): Product[] {
  return products.filter((product) => product.brand === brand && !product.hidden);
}

export function getProduct(brand: BrandSlug, slug: string): Product | undefined {
  return products.find(
    (product) => product.brand === brand && product.slug === slug && !product.hidden,
  );
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = products.filter(
    (item) =>
      item.brand === product.brand &&
      item.id !== product.id &&
      item.category === product.category &&
      !item.hidden,
  );
  const fallback = products.filter(
    (item) =>
      item.brand === product.brand &&
      item.id !== product.id &&
      !sameCategory.includes(item) &&
      !item.hidden,
  );
  return [...sameCategory, ...fallback].slice(0, limit);
}
