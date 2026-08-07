import { Gamepad2, Headphones, Rocket, Trophy } from "lucide-react";
import type { BrandConfig } from "./types";

export const arcadeConfig: BrandConfig = {
  slug: "arcade",
  theme: "theme-arcade",
  name: "LRG Arcade",
  shortName: "Arcade",
  tagline: "Productos Gaming y servicios digitales",
  description:
    "Consolas, videojuegos, accesorios, plataformas streaming y suscripciones de PlayStation. Todo el universo gamer con entrega inmediata y garantía real.",
  keywords: ["gaming", "playstation", "xbox", "nintendo", "pc gaming", "ps plus"],
  hero: {
    eyebrow: "Sector Gaming",
    title: "El arsenal completo para",
    highlight: "jugar sin límites",
    subtitle:
      "Consolas, videojuegos, accesorios de alto rendimiento, suscripciones y servicios digitales activados en minutos.",
    primaryCta: "Explorar catálogo",
    secondaryCta: "Ver suscripciones",
    stats: [
      { label: "Productos activos", value: "480+" },
      { label: "Entregas digitales", value: "< 5 min" },
      { label: "Valoración media", value: "4.9/5" },
    ],
  },
  highlights: [
    {
      title: "Entrega digital inmediata",
      description: "Códigos y suscripciones activados automáticamente tras la confirmación.",
      icon: Rocket,
    },
    {
      title: "Hardware verificado",
      description: "Cada consola y periférico pasa un control técnico antes del envío.",
      icon: Gamepad2,
    },
    {
      title: "Soporte esports",
      description: "Asesoría de setup competitivo, latencia y configuración de periféricos.",
      icon: Trophy,
    },
    {
      title: "Audio de competición",
      description: "Headsets y micrófonos seleccionados por equipos profesionales.",
      icon: Headphones,
    },
  ],
  categories: [
    { slug: "consolas", name: "Consolas", description: "PlayStation, Xbox y Nintendo" },
    { slug: "videojuegos", name: "Videojuegos", description: "Físicos y digitales" },
    { slug: "accesorios", name: "Accesorios", description: "Mandos, headsets y volantes" },
    { slug: "pc-gaming", name: "PC Gaming", description: "Componentes y periféricos" },
    { slug: "suscripciones", name: "Suscripciones", description: "PS Plus, Game Pass y más" },
    { slug: "streaming", name: "Streaming", description: "Capturadoras, luces y audio" },
  ],
  currency: "USD",
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
  payments: ["Visa", "Mastercard", "Amex", "Transferencia", "Crypto"],
  footerNote: "Hardware original con garantía oficial y soporte técnico propio.",
};
