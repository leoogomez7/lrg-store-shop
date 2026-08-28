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
  },
  categories: [
    { slug: "landing-pages", name: "Landing pages", description: "Conversión y campañas" },
    { slug: "ecommerce", name: "Ecommerce", description: "Tiendas completas" },
    { slug: "dashboards", name: "Dashboards", description: "Paneles y analítica" },
    { slug: "software", name: "Software", description: "Sistemas a medida" },
    { slug: "ux-ui", name: "Diseño UX/UI", description: "Design systems y research" },
    { slug: "esports", name: "Esports", description: "Plataformas y torneos" },
  ],
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
  payments: ["Transferencia", "Visa", "Mastercard", "Wise", "Link de Mercado Pago"],
  favicon: "/LRG Web Design PNG.png",
};
