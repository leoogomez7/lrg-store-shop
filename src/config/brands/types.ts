export type BrandSlug = "arcade" | "scents" | "web-design";

export type BrandSubcategory = {
  slug: string;
  name: string;
  children?: BrandSubcategory[];
};

export type StoreShopContactItem = {
  text: string;
  href: string;
  logo: string;
};

export type StoreShopContact = {
  email: StoreShopContactItem;
  phone: StoreShopContactItem;
  location: StoreShopContactItem;
  socials: {
    instagram: StoreShopContactItem;
    whatsapp: StoreShopContactItem;
    tiktok: StoreShopContactItem;
    facebook: StoreShopContactItem;
    trustpilot: StoreShopContactItem;
    google: StoreShopContactItem;
  };
};

export type BrandContactPresentation = StoreShopContact;

export type BrandCategory = {
  slug: string;
  name: string;
  description: string;
  subcategories?: BrandSubcategory[];
};

export type BrandPaymentMethod = {
  id: string;
  name: string;
  enabled: boolean;
  codeRequired?: boolean;
};

export type BrandShippingConfig = {
  freeShippingThreshold: number;
  methods: BrandPaymentMethod[];
};

export type BrandDiscount = {
  id: string;
  code: string;
  percentage: number;
  amount: number;
  enabled: boolean;
};

export type BrandConfig = {
  slug: BrandSlug;
  /** clase de tema definida en styles.css */
  theme: "theme-arcade" | "theme-scents" | "theme-webdesign";
  name: string;
  shortName: string;
  tagline: string;
  description?: string;
  keywords: string[];
  hero: {
    eyebrow: string;
    title: string;
    highlight: string;
  };
  categories: BrandCategory[];
  social: { label: string; href: string }[];
  contact: { email: string; phone: string; location: string; link?: string };
  payments: string[];
  paymentMethods?: BrandPaymentMethod[];
  shipping?: BrandShippingConfig;
  discounts?: BrandDiscount[];
  /** optional path to favicon/logo shown in browser tab (public/) */
  favicon?: string;
};
