import type { LucideIcon } from "lucide-react";

export type BrandSlug = "arcade" | "scents" | "web-design";

export type BrandCategory = {
  slug: string;
  name: string;
  description: string;
  subcategories?: { slug: string; name: string }[];
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
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    stats: { label: string; value: string }[];
  };
  highlights: { title: string; description: string; icon: LucideIcon }[];
  categories: BrandCategory[];
  currency: string;
  social: { label: string; href: string }[];
  contact: { email: string; phone: string; location: string; link?: string };
  payments: string[];
  paymentMethods?: BrandPaymentMethod[];
  shipping?: BrandShippingConfig;
  discounts?: BrandDiscount[];
  footerNote: string;
  /** optional path to favicon/logo shown in browser tab (public/) */
  favicon?: string;
};
