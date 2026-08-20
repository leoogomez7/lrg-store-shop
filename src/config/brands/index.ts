import { arcadeConfig } from "./arcade.config";
import { scentsConfig } from "./scents.config";
import { webDesignConfig } from "./web-design.config";
import type { BrandCategory, BrandConfig, BrandPaymentMethod, BrandShippingConfig, BrandSlug } from "./types";

const CATEGORY_STORAGE_KEY = "lrg-brand-categories-v1";
const CONTACT_STORAGE_KEY = "lrg-brand-contact-v1";
const STORE_SHOP_CONTACT_STORAGE_KEY = "lrg-store-shop-contact-v1";
const BRAND_PRESENTATION_STORAGE_KEY = "lrg-brand-contact-presentation-v1";
const PAYMENT_METHODS_STORAGE_KEY = "lrg:paymentMethods";
const SHIPPING_METHODS_STORAGE_KEY = "lrg:shippingMethods";
const FREE_SHIPPING_THRESHOLD_STORAGE_KEY = "lrg:freeShippingThreshold";
const DEFAULT_FREE_SHIPPING_THRESHOLD = 300;
const DEFAULT_SHIPPING_METHODS: BrandPaymentMethod[] = [
  { id: "physical", name: "Físico", enabled: true, codeRequired: false },
  { id: "digital", name: "Digital", enabled: true, codeRequired: false },
  { id: "whatsapp", name: "WhatsApp", enabled: true, codeRequired: false },
];

const defaultBrands: Record<BrandSlug, BrandConfig> = {
  arcade: arcadeConfig,
  scents: scentsConfig,
  "web-design": webDesignConfig,
};

function readStoredCategories(): Record<BrandSlug, BrandCategory[]> {
  if (typeof window === "undefined") {
    return {
      arcade: defaultBrands.arcade.categories,
      scents: defaultBrands.scents.categories,
      "web-design": defaultBrands["web-design"].categories,
    };
  }

  try {
    const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) {
      return {
        arcade: defaultBrands.arcade.categories,
        scents: defaultBrands.scents.categories,
        "web-design": defaultBrands["web-design"].categories,
      };
    }

    const parsed = JSON.parse(raw) as Partial<Record<BrandSlug, BrandCategory[]>>;
    return {
      arcade: parsed.arcade?.length ? parsed.arcade : defaultBrands.arcade.categories,
      scents: parsed.scents?.length ? parsed.scents : defaultBrands.scents.categories,
      "web-design": parsed["web-design"]?.length ? parsed["web-design"] : defaultBrands["web-design"].categories,
    };
  } catch {
    return {
      arcade: defaultBrands.arcade.categories,
      scents: defaultBrands.scents.categories,
      "web-design": defaultBrands["web-design"].categories,
    };
  }
}

function readStoredContacts(): Record<BrandSlug, BrandConfig["contact"]> {
  if (typeof window === "undefined") {
    return {
      arcade: defaultBrands.arcade.contact,
      scents: defaultBrands.scents.contact,
      "web-design": defaultBrands["web-design"].contact,
    };
  }

  try {
    const raw = window.localStorage.getItem(CONTACT_STORAGE_KEY);
    if (!raw) {
      return {
        arcade: defaultBrands.arcade.contact,
        scents: defaultBrands.scents.contact,
        "web-design": defaultBrands["web-design"].contact,
      };
    }

    const parsed = JSON.parse(raw) as Partial<Record<BrandSlug, BrandConfig["contact"]>>;
    return {
      arcade: { ...defaultBrands.arcade.contact, ...(parsed.arcade ?? {}) },
      scents: { ...defaultBrands.scents.contact, ...(parsed.scents ?? {}) },
      "web-design": { ...defaultBrands["web-design"].contact, ...(parsed["web-design"] ?? {}) },
    };
  } catch {
    return {
      arcade: defaultBrands.arcade.contact,
      scents: defaultBrands.scents.contact,
      "web-design": defaultBrands["web-design"].contact,
    };
  }
}

const paymentMethodsFromBrand = (brand: BrandConfig): BrandPaymentMethod[] =>
  brand.payments.map((name) => ({
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, ""),
    name,
    enabled: true,
  }));

const defaultPaymentMethods: Record<BrandSlug, BrandPaymentMethod[]> = {
  arcade: paymentMethodsFromBrand(arcadeConfig),
  scents: paymentMethodsFromBrand(scentsConfig),
  "web-design": paymentMethodsFromBrand(webDesignConfig),
};

const defaultShippingConfig: Record<BrandSlug, BrandShippingConfig> = {
  arcade: { freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, methods: DEFAULT_SHIPPING_METHODS },
  scents: { freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, methods: DEFAULT_SHIPPING_METHODS },
  "web-design": { freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, methods: DEFAULT_SHIPPING_METHODS },
};

function readStoredPaymentMethods(): Record<BrandSlug, BrandPaymentMethod[]> {
  if (typeof window === "undefined") {
    return defaultPaymentMethods;
  }

  try {
    const raw = window.localStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
    if (!raw) {
      return defaultPaymentMethods;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        arcade: parsed,
        scents: parsed,
        "web-design": parsed,
      };
    }

    return {
      arcade: Array.isArray(parsed.arcade) ? parsed.arcade : defaultPaymentMethods.arcade,
      scents: Array.isArray(parsed.scents) ? parsed.scents : defaultPaymentMethods.scents,
      "web-design": Array.isArray(parsed["web-design"]) ? parsed["web-design"] : defaultPaymentMethods["web-design"],
    };
  } catch {
    return defaultPaymentMethods;
  }
}

function readStoredShippingConfigs(): Record<BrandSlug, BrandShippingConfig> {
  if (typeof window === "undefined") {
    return defaultShippingConfig;
  }

  try {
    const raw = window.localStorage.getItem(SHIPPING_METHODS_STORAGE_KEY);
    if (!raw) {
      return defaultShippingConfig;
    }

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        arcade: { freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, methods: parsed },
        scents: { freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, methods: parsed },
        "web-design": { freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD, methods: parsed },
      };
    }

    return {
      arcade: parsed.arcade && typeof parsed.arcade.freeShippingThreshold === "number" && Array.isArray(parsed.arcade.methods)
        ? parsed.arcade
        : defaultShippingConfig.arcade,
      scents: parsed.scents && typeof parsed.scents.freeShippingThreshold === "number" && Array.isArray(parsed.scents.methods)
        ? parsed.scents
        : defaultShippingConfig.scents,
      "web-design": parsed["web-design"] && typeof parsed["web-design"].freeShippingThreshold === "number" && Array.isArray(parsed["web-design"].methods)
        ? parsed["web-design"]
        : defaultShippingConfig["web-design"],
    };
  } catch {
    return defaultShippingConfig;
  }
}

const initialBrandState = (): Record<BrandSlug, BrandConfig> => {
  const storedCategories = readStoredCategories();
  const storedContacts = readStoredContacts();
  const storedPaymentMethods = readStoredPaymentMethods();
  const storedShippingConfigs = readStoredShippingConfigs();

  return {
    arcade: {
      ...defaultBrands.arcade,
      categories: storedCategories.arcade,
      contact: { ...defaultBrands.arcade.contact, ...storedContacts.arcade },
      payments: storedPaymentMethods.arcade.filter((method) => method.enabled).map((method) => method.name),
      paymentMethods: storedPaymentMethods.arcade,
      shipping: storedShippingConfigs.arcade,
    },
    scents: {
      ...defaultBrands.scents,
      categories: storedCategories.scents,
      contact: { ...defaultBrands.scents.contact, ...storedContacts.scents },
      payments: storedPaymentMethods.scents.filter((method) => method.enabled).map((method) => method.name),
      paymentMethods: storedPaymentMethods.scents,
      shipping: storedShippingConfigs.scents,
    },
    "web-design": {
      ...defaultBrands["web-design"],
      categories: storedCategories["web-design"],
      contact: { ...defaultBrands["web-design"].contact, ...storedContacts["web-design"] },
      payments: storedPaymentMethods["web-design"].filter((method) => method.enabled).map((method) => method.name),
      paymentMethods: storedPaymentMethods["web-design"],
      shipping: storedShippingConfigs["web-design"],
    },
  };
};

export function refreshBrandData() {
  const storedCategories = readStoredCategories();
  const storedContacts = readStoredContacts();
  const storedPaymentMethods = readStoredPaymentMethods();
  const storedShippingConfigs = readStoredShippingConfigs();

  brands = {
    arcade: {
      ...defaultBrands.arcade,
      categories: storedCategories.arcade,
      contact: { ...defaultBrands.arcade.contact, ...storedContacts.arcade },
      payments: storedPaymentMethods.arcade.filter((method) => method.enabled).map((method) => method.name),
      paymentMethods: storedPaymentMethods.arcade,
      shipping: storedShippingConfigs.arcade,
    },
    scents: {
      ...defaultBrands.scents,
      categories: storedCategories.scents,
      contact: { ...defaultBrands.scents.contact, ...storedContacts.scents },
      payments: storedPaymentMethods.scents.filter((method) => method.enabled).map((method) => method.name),
      paymentMethods: storedPaymentMethods.scents,
      shipping: storedShippingConfigs.scents,
    },
    "web-design": {
      ...defaultBrands["web-design"],
      categories: storedCategories["web-design"],
      contact: { ...defaultBrands["web-design"].contact, ...storedContacts["web-design"] },
      payments: storedPaymentMethods["web-design"].filter((method) => method.enabled).map((method) => method.name),
      paymentMethods: storedPaymentMethods["web-design"],
      shipping: storedShippingConfigs["web-design"],
    },
  };

  brandList = Object.values(brands);
  return brands;
}

export function setBrandPaymentMethods(slug: BrandSlug, methods: BrandPaymentMethod[]) {
  const current = readStoredPaymentMethods();
  const next = {
    arcade: current.arcade,
    scents: current.scents,
    "web-design": current["web-design"],
  };

  next[slug] = methods;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(next));
  }

  const fresh = refreshBrandData();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lrg-brand-data-updated"));
  }
  return fresh;
}

export function setBrandShippingConfig(slug: BrandSlug, shippingConfig: BrandShippingConfig) {
  const current = readStoredShippingConfigs();
  const next = {
    arcade: current.arcade,
    scents: current.scents,
    "web-design": current["web-design"],
  };

  next[slug] = shippingConfig;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SHIPPING_METHODS_STORAGE_KEY, JSON.stringify(next));
  }

  const fresh = refreshBrandData();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lrg-brand-data-updated"));
  }
  return fresh;
}

export let brands: Record<BrandSlug, BrandConfig> = initialBrandState();
export let brandList: BrandConfig[] = Object.values(brands);
export const storeShopListing = { slug: "store-shop" as const, name: "LRG Store Shop" };
export const getStoreNavigation = () => [storeShopListing, ...brandList];

export type StoreShopContactItem = { text: string; href: string; logo: string };
export type StoreShopContact = {
  email: StoreShopContactItem;
  phone: StoreShopContactItem;
  location: StoreShopContactItem;
  socials: {
    instagram: StoreShopContactItem;
    whatsapp: StoreShopContactItem;
    tiktok: StoreShopContactItem;
    facebook: StoreShopContactItem;
    review: StoreShopContactItem;
  };
};
export type BrandContactPresentation = StoreShopContact;

const defaultStoreShopContact: StoreShopContact = {
  email: { text: "lrgwebdesign@gmail.com", href: "mailto:lrgwebdesign@gmail.com", logo: "" },
  phone: { text: "+5491132965583", href: "tel:+5491132965583", logo: "" },
  location: {
    text: "Merlo, Buenos Aires, Argentina",
    href: "https://www.google.com/maps/search/?api=1&query=Merlo%2C%20Buenos%20Aires%2C%20Argentina",
    logo: "",
  },
  socials: {
    instagram: { text: "Instagram", href: "", logo: "" },
    whatsapp: { text: "WhatsApp", href: "", logo: "" },
    tiktok: { text: "TikTok", href: "", logo: "" },
    facebook: { text: "Facebook", href: "", logo: "" },
    review: { text: "Reseñas", href: "", logo: "" },
  },
};

function normalizeStoreShopContact(raw: unknown): StoreShopContact {
  const value = (raw ?? {}) as Partial<StoreShopContact> & Record<string, unknown>;
  const normalizeItem = (key: keyof StoreShopContact, fallback: StoreShopContactItem) => {
    const item = value[key];
    if (typeof item === "string") return { ...fallback, text: item };
    return { ...fallback, ...(item as Partial<StoreShopContactItem> ?? {}) };
  };
  return {
    email: normalizeItem("email", defaultStoreShopContact.email),
    phone: normalizeItem("phone", defaultStoreShopContact.phone),
    location: normalizeItem("location", defaultStoreShopContact.location),
    socials: {
      ...defaultStoreShopContact.socials,
      ...(value.socials as Partial<StoreShopContact["socials"]> ?? {}),
    },
  };
}

export function getStoreShopContact() {
  if (typeof window === "undefined") return defaultStoreShopContact;
  try {
    const raw = window.localStorage.getItem(STORE_SHOP_CONTACT_STORAGE_KEY);
    return raw ? normalizeStoreShopContact(JSON.parse(raw)) : defaultStoreShopContact;
  } catch {
    return defaultStoreShopContact;
  }
}

export function setStoreShopContact(contact: Partial<StoreShopContact>) {
  const current = getStoreShopContact();
  const next = {
    ...current,
    ...contact,
    socials: { ...current.socials, ...(contact.socials ?? {}) },
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORE_SHOP_CONTACT_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("lrg-brand-data-updated"));
  }
  return next;
}

export function getBrandContactPresentation(slug: BrandSlug): BrandContactPresentation {
  const brand = brands[slug];
  const fallback: BrandContactPresentation = {
    email: { text: brand.contact.email, href: `mailto:${brand.contact.email}`, logo: "" },
    phone: { text: brand.contact.phone, href: `tel:${brand.contact.phone}`, logo: "" },
    location: {
      text: brand.contact.location,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(brand.contact.location)}`,
      logo: "",
    },
    socials: {
      instagram: { text: "Instagram", href: brand.social.find((item) => item.label.toLowerCase().includes("instagram"))?.href ?? "", logo: "" },
      whatsapp: { text: "WhatsApp", href: brand.social.find((item) => item.label.toLowerCase().includes("whatsapp"))?.href ?? "", logo: "" },
      tiktok: { text: "TikTok", href: brand.social.find((item) => item.label.toLowerCase().includes("tiktok"))?.href ?? "", logo: "" },
      facebook: { text: "Facebook", href: brand.social.find((item) => item.label.toLowerCase().includes("facebook"))?.href ?? "", logo: "" },
      review: { text: "Reseñas", href: "https://es.trustpilot.com/review/psplusargentinaps4.empretienda.com.ar", logo: "" },
    },
  };
  if (typeof window === "undefined") return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(BRAND_PRESENTATION_STORAGE_KEY) ?? "{}") as Record<string, Partial<BrandContactPresentation>>;
    return {
      ...fallback,
      ...(stored[slug] ?? {}),
      socials: { ...fallback.socials, ...(stored[slug]?.socials ?? {}) },
    };
  } catch {
    return fallback;
  }
}

export function setBrandContactPresentation(slug: BrandSlug, presentation: Partial<BrandContactPresentation>) {
  if (typeof window === "undefined") return getBrandContactPresentation(slug);
  const stored = JSON.parse(window.localStorage.getItem(BRAND_PRESENTATION_STORAGE_KEY) ?? "{}") as Record<string, BrandContactPresentation>;
  const current = getBrandContactPresentation(slug);
  const next = {
    ...current,
    ...presentation,
    socials: { ...current.socials, ...(presentation.socials ?? {}) },
  };
  window.localStorage.setItem(BRAND_PRESENTATION_STORAGE_KEY, JSON.stringify({ ...stored, [slug]: next }));
  window.dispatchEvent(new Event("lrg-brand-data-updated"));
  return next;
}

export function getStoreShopCategories() {
  return brandList.flatMap((brand) =>
    brand.categories.map((category) => ({ ...category, brandSlug: brand.slug, brandName: brand.name })),
  );
}

export function setBrandCategories(slug: BrandSlug, categories: BrandCategory[]) {
  const next = {
    arcade: readStoredCategories().arcade,
    scents: readStoredCategories().scents,
    "web-design": readStoredCategories()["web-design"],
  };

  next[slug] = categories;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(next));
  }

  const fresh = refreshBrandData();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lrg-brand-data-updated"));
  }
  return fresh;
}

export function setBrandContact(slug: BrandSlug, contact: Partial<BrandConfig["contact"]>) {
  const current = readStoredContacts();
  const next = {
    arcade: { ...current.arcade },
    scents: { ...current.scents },
    "web-design": { ...current["web-design"] },
  };

  next[slug] = { ...next[slug], ...contact };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(CONTACT_STORAGE_KEY, JSON.stringify(next));
  }

  const fresh = refreshBrandData();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lrg-brand-data-updated"));
  }
  return fresh;
}

export function isBrandSlug(value: string): value is BrandSlug {
  return value in brands;
}

export function getBrand(slug: string): BrandConfig | undefined {
  const fresh = refreshBrandData();
  return isBrandSlug(slug) ? fresh[slug] : undefined;
}

export type { BrandConfig, BrandCategory, BrandPaymentMethod, BrandShippingConfig, BrandSlug } from "./types";
