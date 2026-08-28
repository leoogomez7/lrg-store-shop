import type { BrandConfig } from "./types";

export const scentsConfig: BrandConfig = {
  slug: "scents",
  theme: "theme-webdesign",
  name: "LRG Scents",
  shortName: "Scents",
  tagline: "Perfumes árabes originales",
  keywords: ["perfumería árabe", "fragancias", "extracto de perfume", "lujo", "oud"],
  hero: {
    eyebrow: "Sector Fragancias",
    title: "Fragancias que se",
    highlight: "recuerdan",
  },
  categories: [
    { slug: "perfumeria-arabe", name: "Perfumería árabe", description: "Oud, ámbar y especias" },
    { slug: "extractos", name: "Extractos", description: "Máxima concentración" },
    { slug: "eau-de-parfum", name: "Eau de parfum", description: "Uso diario intenso" },
    { slug: "nicho", name: "Nicho", description: "Ediciones limitadas" },
    { slug: "body-mist", name: "Body mist", description: "Frescura ligera" },
    { slug: "sets", name: "Sets & regalo", description: "Estuches y descubrimiento" },
  ],
  social: [
    { label: "Instagram", href: "https://www.instagram.com/lrg.scents/" },
    { label: "WhatsApp", href: "https://wa.me/541132965583" },
    { label: "TikTok", href: "https://www.tiktok.com/@lrg.scents" },
    { label: "Facebook", href: "https://www.facebook.com/lrg.scents" },
  ],
  contact: {
    email: "leo7perfume@hotmail.com",
    phone: "+5491132965583",
    location: "Merlo, Buenos Aires, Argentina",
  },
  payments: ["Visa", "Mastercard", "Amex", "Transferencia", "Link de Mercado Pago"],
  favicon: "/LRG Scents PNG.png",
};
