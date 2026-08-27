import { Feather, Gem, Leaf, ShieldCheck } from "lucide-react";
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
    subtitle:
      "Extractos árabes de alta concentración, notas de oud, ámbar y azafrán. Curaduría exclusiva, presentación impecable.",
    primaryCta: "Descubrir colección",
    secondaryCta: "Guía de notas",
    stats: [
      { label: "Casas seleccionadas", value: "24" },
      { label: "Duración media", value: "12 h" },
      { label: "Fragancias curadas", value: "160+" },
    ],
  },
  highlights: [
    {
      title: "Originalidad garantizada",
      description: "Importación directa con trazabilidad de lote en cada frasco.",
      icon: ShieldCheck,
    },
    {
      title: "Alta concentración",
      description: "Extraits y eau de parfum con proyección y fijación superiores.",
      icon: Gem,
    },
    {
      title: "Curaduría olfativa",
      description: "Selección por familias: ámbar, oud, floral oriental y especiada.",
      icon: Leaf,
    },
    {
      title: "Presentación de lujo",
      description: "Empaque premium, muestras y tarjeta olfativa en cada pedido.",
      icon: Feather,
    },
  ],
  categories: [
    { slug: "perfumeria-arabe", name: "Perfumería árabe", description: "Oud, ámbar y especias" },
    { slug: "extractos", name: "Extractos", description: "Máxima concentración" },
    { slug: "eau-de-parfum", name: "Eau de parfum", description: "Uso diario intenso" },
    { slug: "nicho", name: "Nicho", description: "Ediciones limitadas" },
    { slug: "body-mist", name: "Body mist", description: "Frescura ligera" },
    { slug: "sets", name: "Sets & regalo", description: "Estuches y descubrimiento" },
  ],
  currency: "USD",
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
  footerNote: "Fragancias 100% originales con envío protegido y muestras de cortesía.",
  favicon: "/LRG Scents PNG.png",
};
