import type { BrandSlug } from "@/config/brands";
import { saveAdminProducts } from "@/server/persistence";

export function saveProducts(products: Product[]) {
  void saveAdminProducts({ data: { products } });
}

export type CurrencyCode = "ARS" | "USD";

export type ProductVariant = {
  id: string;
  name: string;
  price: number;
  priceCurrency?: CurrencyCode;
  comision?: number;
  comisionCurrency?: CurrencyCode;
  gastos?: number;
  gastosCurrency?: CurrencyCode;
  description: string;
  stock: number;
  features?: string[];
  deliveryUnit?: "inmediata" | "horas" | "dias";
  deliveryAmount?: number;
  discount?: number;
  supplier?: ProductSupplier;
};

export type ProductSupplier = {
  name: string;
  phone: string;
  social: string;
  purchaseDate: string;
};

export type Product = {
  id: string;
  slug: string;
  brand: BrandSlug;
  /** When true the product should be hidden from public listings */
  hidden?: boolean;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  priceCurrency?: CurrencyCode;
  comision?: number;
  comisionCurrency?: CurrencyCode;
  variants?: ProductVariant[];
  supplier?: ProductSupplier;
  gastos?: number;
  gastosCurrency?: CurrencyCode;
  usdRate?: number;
  compareAtPrice?: number;
  stock: number;
  rating: number;
  reviews: number;
  badge?: string;
  short: string;
  description: string;
  features: string[];
  images?: string[];
  createdAt: string;
};

const p = (product: Product): Product => product;

const defaultProducts: Product[] = [];
/*
const legacyDefaultProducts: Product[] = [
  // ---------------- LRG Arcade ----------------
  p({
    id: "arc-001",
    slug: "playstation-5-slim-digital",
    brand: "arcade",
    name: "PlayStation 5 Slim Digital",
    category: "consolas",
    price: 469,
    compareAtPrice: 529,
    stock: 12,
    rating: 4.9,
    reviews: 214,
    short: "Consola de nueva generación con SSD ultrarrápido y ray tracing.",
    description:
      "La versión Slim Digital de PlayStation 5 mantiene toda la potencia de la generación: SSD de acceso instantáneo, audio 3D Tempest y ray tracing por hardware, en un chasis un 30% más compacto.",
    features: ["SSD 1 TB", "4K 120 Hz", "Ray tracing", "DualSense incluido"],
    createdAt: "2026-05-02",
  }),
  p({
    id: "arc-002",
    slug: "xbox-series-x-2tb",
    brand: "arcade",
    name: "Xbox Series X 2TB Galaxy",
    category: "consolas",
    price: 599,
    stock: 6,
    rating: 4.8,
    reviews: 132,
    short: "La Xbox más potente, con 2 TB y Quick Resume instantáneo.",
    description:
      "Edición especial Galaxy Black con 2 TB de almacenamiento personalizado. 12 teraflops de potencia gráfica, Quick Resume y compatibilidad con cuatro generaciones de juegos.",
    features: ["2 TB SSD", "12 TFLOPS", "Quick Resume", "Dolby Vision"],
    createdAt: "2026-04-18",
  }),
  p({
    id: "arc-003",
    slug: "nintendo-switch-oled-edicion-especial",
    brand: "arcade",
    name: "Nintendo Switch OLED Edición Especial",
    category: "consolas",
    price: 379,
    stock: 0,
    rating: 4.7,
    reviews: 98,
    badge: "Sin stock",
    short: "Pantalla OLED de 7 pulgadas y dock con LAN integrada.",
    description:
      "Pantalla OLED de 7 pulgadas con colores intensos, base con puerto LAN, 64 GB de almacenamiento interno y soporte ajustable de ancho completo.",
    features: ['OLED 7"', "64 GB", "Dock con LAN", "Joy-Con incluidos"],
    createdAt: "2026-03-30",
  }),
  p({
    id: "arc-004",
    slug: "ps-plus-premium-12-meses",
    brand: "arcade",
    name: "PS Plus Premium · 12 meses",
    category: "suscripciones",
    price: 119,
    compareAtPrice: 159,
    stock: 999,
    rating: 4.8,
    reviews: 421,
    badge: "Entrega digital",
    short: "Catálogo completo, clásicos y pruebas de juego por un año.",
    description:
      "El nivel más alto de PlayStation Plus: catálogo de juegos, clásicos de generaciones anteriores, streaming en la nube y pruebas de títulos antes de comprarlos. Activación digital inmediata.",
    features: ["Catálogo Premium", "Cloud streaming", "Clásicos PS1-PS3", "Activación inmediata"],
    createdAt: "2026-06-01",
  }),
  p({
    id: "arc-005",
    slug: "mando-pro-inalambrico-elite",
    brand: "arcade",
    name: "Mando Pro Inalámbrico Elite",
    category: "accesorios",
    price: 149,
    stock: 34,
    rating: 4.6,
    reviews: 176,
    short: "Gatillos hall effect, paletas traseras y perfiles configurables.",
    description:
      "Diseñado para juego competitivo: sensores hall effect sin drift, cuatro paletas traseras, gatillos de recorrido ajustable y tres perfiles guardados en el propio mando.",
    features: ["Hall effect", "4 paletas", "Perfiles onboard", "40 h de batería"],
    createdAt: "2026-05-21",
  }),
  p({
    id: "arc-006",
    slug: "headset-esports-7-1",
    brand: "arcade",
    name: "Headset Esports 7.1 Titan",
    category: "accesorios",
    price: 129,
    stock: 41,
    rating: 4.5,
    reviews: 88,
    short: "Audio espacial 7.1 con micrófono de cancelación activa.",
    description:
      "Drivers de 50 mm, audio espacial 7.1 certificado, micrófono desmontable con cancelación de ruido y almohadillas de espuma viscoelástica para sesiones largas.",
    features: ["Drivers 50 mm", "7.1 espacial", "Mic ANC", "Multiplataforma"],
    createdAt: "2026-04-05",
  }),
  p({
    id: "arc-007",
    slug: "teclado-mecanico-tkl-rapid",
    brand: "arcade",
    name: "Teclado Mecánico TKL Rapid",
    category: "pc-gaming",
    price: 179,
    stock: 22,
    rating: 4.7,
    reviews: 143,
    short: "Switches magnéticos con actuación ajustable y 8K Hz de polling.",
    description:
      "Switches magnéticos con punto de actuación configurable entre 0.1 y 3.8 mm, polling de 8000 Hz, doble shot PBT y software de macros por capas.",
    features: ["8K Hz polling", "Actuación ajustable", "PBT doble shot", "Hot-swap"],
    createdAt: "2026-06-08",
  }),
  p({
    id: "arc-008",
    slug: "capturadora-4k60-stream",
    brand: "arcade",
    name: "Capturadora 4K60 Stream",
    category: "streaming",
    price: 219,
    stock: 15,
    rating: 4.6,
    reviews: 61,
    short: "Captura 4K60 HDR con passthrough sin latencia.",
    description:
      "Captura y transmite en 4K60 HDR10 con passthrough 4K144, latencia imperceptible y compatibilidad directa con OBS, Streamlabs y consolas.",
    features: ["4K60 HDR", "Passthrough 4K144", "USB-C 3.2", "OBS ready"],
    createdAt: "2026-05-11",
  }),
  p({
    id: "arc-009",
    slug: "juego-neon-horizon-edicion-deluxe",
    brand: "arcade",
    name: "Neon Horizon · Edición Deluxe",
    category: "videojuegos",
    price: 79,
    compareAtPrice: 89,
    stock: 58,
    rating: 4.4,
    reviews: 267,
    short: "Mundo abierto cyberpunk con expansión incluida.",
    description:
      "Edición Deluxe con el juego base, la primera expansión, banda sonora digital y paquete de mejoras cosméticas. Disponible en formato físico y digital.",
    features: ["Expansión incluida", "Banda sonora", "Upgrade next-gen", "Español latino"],
    createdAt: "2026-06-14",
  }),
  p({
    id: "arc-010",
    slug: "volante-force-feedback-gt",
    brand: "arcade",
    name: "Volante Force Feedback GT",
    category: "pc-gaming",
    price: 549,
    stock: 4,
    rating: 4.9,
    reviews: 52,
    badge: "Stock limitado",
    short: "Base direct drive de 8 Nm con pedalera de carga.",
    description:
      "Base direct drive de 8 Nm, aro de cuero perforado con levas magnéticas y pedalera con celda de carga ajustable. Compatible con PC y consolas.",
    features: ["Direct drive 8 Nm", "Load cell", "Levas magnéticas", "Quick release"],
    createdAt: "2026-03-12",
  }),

  // ---------------- LRG Scents ----------------
  p({
    id: "scn-001",
    slug: "oud-royal-extrait",
    brand: "scents",
    name: "Oud Royal Extrait",
    category: "extractos",
    price: 189,
    stock: 18,
    rating: 4.9,
    reviews: 143,
    badge: "Icónico",
    short: "Oud camboyano, azafrán y ámbar en concentración extrait.",
    description:
      "Un extrait de 30% de concentración construido sobre oud camboyano envejecido, azafrán persa y una base de ámbar y sándalo. Proyección amplia y estela de más de doce horas.",
    features: ["30% concentración", "Oud camboyano", "12 h de duración", "50 ml"],
    createdAt: "2026-05-06",
  }),
  p({
    id: "scn-002",
    slug: "ambar-noir-eau-de-parfum",
    brand: "scents",
    name: "Ámbar Noir Eau de Parfum",
    category: "eau-de-parfum",
    price: 129,
    compareAtPrice: 149,
    stock: 26,
    rating: 4.7,
    reviews: 201,
    short: "Ámbar cálido, vainilla bourbon y cuero suave.",
    description:
      "Apertura de bergamota y pimienta rosa que cae hacia un corazón de ámbar y vainilla bourbon, cerrando con cuero suave y musgo blanco. Elegante y envolvente.",
    features: ["Ámbar & vainilla", "Uso nocturno", "8 h de duración", "100 ml"],
    createdAt: "2026-04-22",
  }),
  p({
    id: "scn-003",
    slug: "rosa-taifi-intense",
    brand: "scents",
    name: "Rosa Taifi Intense",
    category: "perfumeria-arabe",
    price: 159,
    stock: 11,
    rating: 4.8,
    reviews: 97,
    short: "Rosa de Taif, oud y miel especiada.",
    description:
      "La rosa de Taif en su versión más rica: pétalos frescos sobre oud, miel especiada y un fondo de pachulí. Una fragancia unisex de carácter oriental clásico.",
    features: ["Rosa de Taif", "Unisex", "10 h de duración", "60 ml"],
    createdAt: "2026-05-29",
  }),
  p({
    id: "scn-004",
    slug: "musk-blanc-nicho",
    brand: "scents",
    name: "Musk Blanc · Nicho",
    category: "nicho",
    price: 215,
    stock: 7,
    rating: 4.8,
    reviews: 44,
    badge: "Edición limitada",
    short: "Almizcle blanco, iris y papel de arroz.",
    description:
      "Edición limitada de 300 frascos numerados. Almizcle blanco luminoso con iris pulverizado, papel de arroz y una gota de heliotropo. Minimalismo olfativo absoluto.",
    features: ["300 unidades", "Frasco numerado", "Iris & almizcle", "50 ml"],
    createdAt: "2026-06-03",
  }),
  p({
    id: "scn-005",
    slug: "azafran-imperial",
    brand: "scents",
    name: "Azafrán Imperial",
    category: "perfumeria-arabe",
    price: 145,
    stock: 0,
    rating: 4.6,
    reviews: 76,
    badge: "Sin stock",
    short: "Azafrán, cuero y dátil confitado.",
    description:
      "Una lectura moderna de la tradición árabe: azafrán y cuero sobre dátil confitado y benjuí. Perfil especiado, dulce y profundamente cálido.",
    features: ["Azafrán persa", "Notas de cuero", "9 h de duración", "75 ml"],
    createdAt: "2026-02-27",
  }),
  p({
    id: "scn-006",
    slug: "set-descubrimiento-oriental",
    brand: "scents",
    name: "Set Descubrimiento Oriental",
    category: "sets",
    price: 89,
    compareAtPrice: 110,
    stock: 40,
    rating: 4.7,
    reviews: 158,
    short: "Seis atomizadores de 10 ml de la colección árabe.",
    description:
      "Seis atomizadores de 10 ml con las fragancias más representativas de la colección árabe, presentados en estuche rígido con tarjetas olfativas de cada referencia.",
    features: ["6 × 10 ml", "Estuche rígido", "Tarjetas olfativas", "Ideal regalo"],
    createdAt: "2026-06-10",
  }),
  p({
    id: "scn-007",
    slug: "body-mist-fleur-de-lune",
    brand: "scents",
    name: "Body Mist Fleur de Lune",
    category: "body-mist",
    price: 45,
    stock: 63,
    rating: 4.4,
    reviews: 132,
    short: "Bruma ligera de jazmín nocturno y almizcle.",
    description:
      "Bruma corporal de textura ligera con jazmín nocturno, pera y almizcle suave. Ideal para capas sobre extraits o para uso diario en climas cálidos.",
    features: ["200 ml", "Jazmín nocturno", "Layering", "Sin alcohol agresivo"],
    createdAt: "2026-05-16",
  }),
  p({
    id: "scn-008",
    slug: "sandalo-blanco-extrait",
    brand: "scents",
    name: "Sándalo Blanco Extrait",
    category: "extractos",
    price: 175,
    stock: 14,
    rating: 4.8,
    reviews: 69,
    short: "Sándalo de Mysore, cardamomo y leche de higo.",
    description:
      "Sándalo de Mysore en el centro absoluto, acompañado por cardamomo verde y una nota lechosa de higo. Cremoso, sereno y de una elegancia silenciosa.",
    features: ["Sándalo Mysore", "25% concentración", "11 h de duración", "50 ml"],
    createdAt: "2026-04-09",
  }),
  p({
    id: "scn-009",
    slug: "vetiver-noir-eau-de-parfum",
    brand: "scents",
    name: "Vetiver Noir Eau de Parfum",
    category: "eau-de-parfum",
    price: 119,
    stock: 31,
    rating: 4.5,
    reviews: 84,
    short: "Vetiver de Haití, pomelo y tabaco rubio.",
    description:
      "Vetiver de Haití con un destello de pomelo y un fondo de tabaco rubio y haba tonka. Masculino contemporáneo, versátil de día y de noche.",
    features: ["Vetiver Haití", "Uso diario", "8 h de duración", "100 ml"],
    createdAt: "2026-05-25",
  }),
  p({
    id: "scn-010",
    slug: "coleccion-privee-nicho",
    brand: "scents",
    name: "Collection Privée · Trío Nicho",
    category: "nicho",
    price: 320,
    stock: 5,
    rating: 5,
    reviews: 21,
    badge: "Exclusivo",
    short: "Tres extraits de autor en presentación de coleccionista.",
    description:
      "Tres extraits de autor en frascos de cristal soplado, con caja lacada, certificado de origen y grabado personalizable. La expresión máxima de la casa.",
    features: ["3 × 50 ml", "Cristal soplado", "Grabado personalizado", "Certificado"],
    createdAt: "2026-06-16",
  }),

  // ---------------- LRG Web Design ----------------
  p({
    id: "wdz-001",
    slug: "landing-page-conversion",
    brand: "web-design",
    name: "Landing Page de Conversión",
    category: "landing-pages",
    price: 1490,
    stock: 8,
    rating: 4.9,
    reviews: 64,
    badge: "Entrega 10 días",
    short: "Landing de una página con copy, diseño y analítica.",
    description:
      "Landing de alto rendimiento con estructura de conversión, copywriting, diseño a medida, animaciones y analítica configurada. Incluye dos rondas de iteración.",
    features: ["Copy incluido", "Diseño a medida", "Analítica", "2 iteraciones"],
    createdAt: "2026-06-02",
  }),
  p({
    id: "wdz-002",
    slug: "tienda-ecommerce-completa",
    brand: "web-design",
    name: "Tienda Ecommerce Completa",
    category: "ecommerce",
    price: 4900,
    compareAtPrice: 5600,
    stock: 4,
    rating: 4.8,
    reviews: 38,
    short: "Catálogo, carrito, checkout y panel de administración.",
    description:
      "Ecommerce completo con catálogo, filtros, carrito persistente, checkout, gestión de pedidos y panel administrativo con roles. Arquitectura modular preparada para escalar.",
    features: ["Panel admin", "Checkout", "Roles y permisos", "SEO técnico"],
    createdAt: "2026-05-19",
  }),
  p({
    id: "wdz-003",
    slug: "dashboard-analitico",
    brand: "web-design",
    name: "Dashboard Analítico",
    category: "dashboards",
    price: 3600,
    stock: 5,
    rating: 4.9,
    reviews: 29,
    short: "Métricas en tiempo real, roles y exportaciones.",
    description:
      "Panel de métricas con visualizaciones interactivas, filtros temporales, roles diferenciados, exportación a CSV y arquitectura de datos documentada.",
    features: ["Gráficos interactivos", "Roles", "Exportación CSV", "Documentación"],
    createdAt: "2026-04-28",
  }),
  p({
    id: "wdz-004",
    slug: "design-system-ux-ui",
    brand: "web-design",
    name: "Design System UX/UI",
    category: "ux-ui",
    price: 2800,
    stock: 6,
    rating: 4.8,
    reviews: 41,
    short: "Tokens, componentes y documentación viva.",
    description:
      "Sistema de diseño completo: tokens de color, tipografía y espaciado, biblioteca de componentes en Figma y código, más guía de uso y criterios de accesibilidad.",
    features: ["Tokens", "Librería Figma", "Componentes en código", "Guía de uso"],
    createdAt: "2026-06-07",
  }),
  p({
    id: "wdz-005",
    slug: "software-a-medida",
    brand: "web-design",
    name: "Software a Medida",
    category: "software",
    price: 8900,
    stock: 2,
    rating: 5,
    reviews: 17,
    badge: "Por sprint",
    short: "Sistema completo con arquitectura modular y tests.",
    description:
      "Desarrollo de sistema a medida por sprints: descubrimiento, arquitectura, implementación tipada, pruebas automatizadas, despliegue y transferencia de conocimiento.",
    features: ["Sprints de 2 semanas", "Tests automatizados", "CI/CD", "Handover"],
    createdAt: "2026-03-24",
  }),
  p({
    id: "wdz-006",
    slug: "plataforma-esports",
    brand: "web-design",
    name: "Plataforma Esports",
    category: "esports",
    price: 6400,
    stock: 3,
    rating: 4.7,
    reviews: 12,
    short: "Torneos, brackets, perfiles y streaming integrado.",
    description:
      "Plataforma para organizaciones y torneos: inscripciones, brackets automáticos, perfiles de jugador, tablas de posiciones e integración con plataformas de streaming.",
    features: ["Brackets automáticos", "Perfiles", "Ranking", "Integración Twitch"],
    createdAt: "2026-05-08",
  }),
  p({
    id: "wdz-007",
    slug: "auditoria-performance-seo",
    brand: "web-design",
    name: "Auditoría Performance & SEO",
    category: "software",
    price: 890,
    stock: 12,
    rating: 4.6,
    reviews: 55,
    short: "Diagnóstico técnico con plan de acción priorizado.",
    description:
      "Auditoría de Core Web Vitals, accesibilidad, SEO técnico y arquitectura de código, entregada como informe priorizado por impacto y esfuerzo.",
    features: ["Core Web Vitals", "SEO técnico", "Accesibilidad", "Plan priorizado"],
    createdAt: "2026-06-12",
  }),
  p({
    id: "wdz-008",
    slug: "rediseno-marca-digital",
    brand: "web-design",
    name: "Rediseño de Marca Digital",
    category: "ux-ui",
    price: 3200,
    stock: 4,
    rating: 4.8,
    reviews: 23,
    short: "Identidad, sistema visual y aplicación web.",
    description:
      "Rediseño integral de identidad digital: logotipo, paleta, tipografía, sistema visual y su aplicación en la web principal y piezas de campaña.",
    features: ["Identidad", "Paleta y tipografía", "Aplicación web", "Manual de marca"],
    createdAt: "2026-04-14",
  }),
  p({
    id: "wdz-009",
    slug: "app-web-progresiva",
    brand: "web-design",
    name: "Aplicación Web Progresiva",
    category: "software",
    price: 5400,
    stock: 3,
    rating: 4.7,
    reviews: 19,
    short: "PWA instalable con soporte offline y notificaciones.",
    description:
      "Aplicación web progresiva instalable, con caché offline, notificaciones push, autenticación y sincronización de datos en segundo plano.",
    features: ["Instalable", "Offline first", "Push", "Sincronización"],
    createdAt: "2026-05-31",
  }),
  p({
    id: "wdz-010",
    slug: "sprint-de-producto",
    brand: "web-design",
    name: "Sprint de Producto",
    category: "landing-pages",
    price: 1990,
    stock: 6,
    rating: 4.9,
    reviews: 31,
    short: "Una semana de diseño intensivo con prototipo navegable.",
    description:
      "Cinco días de trabajo intensivo: definición del problema, exploración de soluciones, prototipo navegable y test con usuarios reales. Resultado listo para desarrollo.",
    features: ["5 días", "Prototipo navegable", "Test con usuarios", "Roadmap"],
    createdAt: "2026-06-15",
  }),
];
*/

function readStoredProducts(): Product[] {
  return [];
}

export const products: Product[] = [];

export function getProductsByBrand(brand: BrandSlug): Product[] {
  return products.filter((product) => product.brand === brand && !product.hidden);
}

export function getProduct(brand: BrandSlug, slug: string): Product | undefined {
  return products.find(
    (product) => product.brand === brand && product.slug === slug && !product.hidden,
  );
}

export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = products.filter(
    (item) =>
      item.brand === product.brand &&
      item.id !== product.id &&
      item.category === product.category &&
      !item.hidden,
  );
  const fallback = products.filter(
    (item) =>
      item.brand === product.brand &&
      item.id !== product.id &&
      !sameCategory.includes(item) &&
      !item.hidden,
  );
  return [...sameCategory, ...fallback].slice(0, limit);
}
