import type { BrandConfig } from "./types";

export const arcadeConfig: BrandConfig = {
  slug: "arcade",
  theme: "theme-webdesign",
  name: "LRG Arcade",
  shortName: "Arcade",
  tagline: "Productos Gaming y servicios digitales",
  keywords: ["gaming", "playstation", "xbox", "nintendo", "pc gaming", "ps plus"],
  hero: {
    eyebrow: "Sector Gaming",
    title: "El arsenal completo para",
    highlight: "jugar sin límites y el maratón de streaming definitivo",
  },
  categories: [
    { slug: "consolas", name: "Consolas", description: "PlayStation, Xbox y Nintendo" },
    { slug: "videojuegos", name: "Videojuegos", description: "Físicos y digitales" },
    { slug: "accesorios", name: "Accesorios", description: "Mandos, headsets y volantes" },
    { slug: "pc-gaming", name: "PC Gaming", description: "Componentes y periféricos" },
    { slug: "suscripciones", name: "Suscripciones", description: "PS Plus, Game Pass y más" },
    { slug: "streaming", name: "Streaming", description: "Capturadoras, luces y audio" },
  ],
  social: [
    { label: "Instagram", href: "https://www.instagram.com/lrg.arcade/" },
    { label: "WhatsApp", href: "https://wa.me/541132965583" },
    { label: "TikTok", href: "https://www.tiktok.com/@lrg.arcade" },
    { label: "Facebook", href: "https://www.facebook.com/lrg.arcade" },
  ],
  contact: {
    email: "psplusjuegos03@gmail.com",
    phone: "+5491132965583",
    location: "Merlo, Buenos Aires, Argentina",
  },
  payments: ["Visa", "Mastercard", "Amex", "Transferencia", "Crypto", "Link de Mercado Pago"],
  favicon: "/LRG Arcade PNG.png",
};
