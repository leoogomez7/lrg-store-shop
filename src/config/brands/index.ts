import { arcadeConfig } from "./arcade.config";
import { scentsConfig } from "./scents.config";
import { webDesignConfig } from "./web-design.config";
import type { BrandCategory, BrandConfig, BrandSlug } from "./types";

const CATEGORY_STORAGE_KEY = "lrg-brand-categories-v1";
const CONTACT_STORAGE_KEY = "lrg-brand-contact-v1";

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

const initialBrandState = (): Record<BrandSlug, BrandConfig> => {
  const storedCategories = readStoredCategories();
  const storedContacts = readStoredContacts();

  return {
    arcade: {
      ...defaultBrands.arcade,
      categories: storedCategories.arcade,
      contact: { ...defaultBrands.arcade.contact, ...storedContacts.arcade },
    },
    scents: {
      ...defaultBrands.scents,
      categories: storedCategories.scents,
      contact: { ...defaultBrands.scents.contact, ...storedContacts.scents },
    },
    "web-design": {
      ...defaultBrands["web-design"],
      categories: storedCategories["web-design"],
      contact: { ...defaultBrands["web-design"].contact, ...storedContacts["web-design"] },
    },
  };
};

export function refreshBrandData() {
  const storedCategories = readStoredCategories();
  const storedContacts = readStoredContacts();

  brands = {
    arcade: {
      ...defaultBrands.arcade,
      categories: storedCategories.arcade,
      contact: { ...defaultBrands.arcade.contact, ...storedContacts.arcade },
    },
    scents: {
      ...defaultBrands.scents,
      categories: storedCategories.scents,
      contact: { ...defaultBrands.scents.contact, ...storedContacts.scents },
    },
    "web-design": {
      ...defaultBrands["web-design"],
      categories: storedCategories["web-design"],
      contact: { ...defaultBrands["web-design"].contact, ...storedContacts["web-design"] },
    },
  };

  brandList = Object.values(brands);
  return brands;
}

export let brands: Record<BrandSlug, BrandConfig> = initialBrandState();
export let brandList: BrandConfig[] = Object.values(brands);

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

export type { BrandConfig, BrandCategory, BrandSlug } from "./types";
