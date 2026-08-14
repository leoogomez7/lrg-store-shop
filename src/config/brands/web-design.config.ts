import { Code2, LayoutDashboard, LineChart, Sparkles } from "lucide-react";
import type { BrandConfig } from "./types";

export const webDesignConfig: BrandConfig = {
  slug: "web-design",
  theme: "theme-webdesign",
  name: "LRG Web Design",
  shortName: "Web Design",
  tagline: "Software y diseño de páginas web",
  keywords: ["desarrollo web", "landing page", "dashboard", "ux ui", "software", "esports"],
  hero: {
    eyebrow: "Sector Software",
    title: "Duplica tus ventas",
    highlight: "mejorando la experiencia de tus usuarios",
    subtitle:
      "Diseñamos y desarrollamos landings, dashboards, ecommerce y software con arquitectura escalable y diseño impecable.",
    primaryCta: "Ver servicios",
    stats: [
      { label: "Proyectos entregados", value: "120+" },
      { label: "Performance media", value: "98 Lighthouse" },
      { label: "Tiempo de entrega", value: "2-6 semanas" },
    ],
  },
  highlights: [
    {
      title: "Diseño UX/UI de producto",
      description: "Design system propio, prototipos navegables y validación con usuarios.",
      icon: Sparkles,
    },
    {
      title: "Arquitectura escalable",
      description: "Código modular, tipado y testeable, preparado para crecer años.",
      icon: Code2,
    },
    {
      title: "Dashboards y paneles",
      description: "Métricas, roles, permisos y visualizaciones en tiempo real.",
      icon: LayoutDashboard,
    },
    {
      title: "Performance medible",
      description: "Core Web Vitals, SEO técnico y analítica desde el primer sprint.",
      icon: LineChart,
    },
  ],
  categories: [
    { slug: "landing-pages", name: "Landing pages", description: "Conversión y campañas" },
    { slug: "ecommerce", name: "Ecommerce", description: "Tiendas completas" },
    { slug: "dashboards", name: "Dashboards", description: "Paneles y analítica" },
    { slug: "software", name: "Software", description: "Sistemas a medida" },
    { slug: "ux-ui", name: "Diseño UX/UI", description: "Design systems y research" },
    { slug: "esports", name: "Esports", description: "Plataformas y torneos" },
  ],
  currency: "USD",
  social: [
    { label: "Instagram", href: "https://www.instagram.com/lrg.web.design/" },
    { label: "WhatsApp", href: "https://wa.me/541132965583" },
    { label: "TikTok", href: "https://www.tiktok.com/@lrg.web.design" },
    { label: "Facebook", href: "https://www.facebook.com/lrg.web.design" },
  ],
  contact: {
    email: "lrgwebdesign@gmail.com",
    phone: "+5491132965583",
    location: "Merlo, Buenos Aires, Argentina",
  },
  payments: ["Transferencia", "Visa", "Mastercard", "Wise"],
  footerNote: "Contratos por alcance, entregas por sprint y documentación incluida.",
  favicon: "/LRG Web Design PNG.png",
};
