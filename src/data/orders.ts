import type { BrandSlug } from "@/config/brands";

export type OrderStatus = "pendiente" | "pagado" | "enviado" | "entregado" | "cancelado";

export type Order = {
  id: string;
  brand: BrandSlug;
  customer: string;
  email: string;
  date: string;
  total: number;
  status: OrderStatus;
  items: { name: string; quantity: number; price: number }[];
};

export const orders: Order[] = [
  {
    id: "LRG-24810",
    brand: "arcade",
    customer: "Martín Rivas",
    email: "martin.rivas@mail.com",
    date: "2026-08-02",
    total: 618,
    status: "enviado",
    items: [
      { name: "PlayStation 5 Slim Digital", quantity: 1, price: 469 },
      { name: "Mando Pro Inalámbrico Elite", quantity: 1, price: 149 },
    ],
  },
  {
    id: "LRG-24809",
    brand: "scents",
    customer: "Lucía Ferrer",
    email: "lucia.ferrer@mail.com",
    date: "2026-08-01",
    total: 278,
    status: "pagado",
    items: [
      { name: "Oud Royal Extrait", quantity: 1, price: 189 },
      { name: "Set Descubrimiento Oriental", quantity: 1, price: 89 },
    ],
  },
  {
    id: "LRG-24805",
    brand: "web-design",
    customer: "Estudio Nordia",
    email: "hola@nordia.studio",
    date: "2026-07-28",
    total: 4900,
    status: "entregado",
    items: [{ name: "Tienda Ecommerce Completa", quantity: 1, price: 4900 }],
  },
  {
    id: "LRG-24801",
    brand: "arcade",
    customer: "Sofía Duarte",
    email: "sofia.duarte@mail.com",
    date: "2026-07-26",
    total: 119,
    status: "entregado",
    items: [{ name: "PS Plus Premium · 12 meses", quantity: 1, price: 119 }],
  },
  {
    id: "LRG-24796",
    brand: "scents",
    customer: "Iván Molina",
    email: "ivan.molina@mail.com",
    date: "2026-07-22",
    total: 175,
    status: "pendiente",
    items: [{ name: "Sándalo Blanco Extrait", quantity: 1, price: 175 }],
  },
  {
    id: "LRG-24790",
    brand: "web-design",
    customer: "Aurora Labs",
    email: "team@auroralabs.io",
    date: "2026-07-18",
    total: 3600,
    status: "cancelado",
    items: [{ name: "Dashboard Analítico", quantity: 1, price: 3600 }],
  },
];

export const revenueByMonth = [
  { month: "Feb", arcade: 12400, scents: 8200, webDesign: 14200 },
  { month: "Mar", arcade: 15100, scents: 9400, webDesign: 16800 },
  { month: "Abr", arcade: 17600, scents: 11200, webDesign: 15400 },
  { month: "May", arcade: 21300, scents: 13800, webDesign: 21900 },
  { month: "Jun", arcade: 24800, scents: 15400, webDesign: 26400 },
  { month: "Jul", arcade: 27900, scents: 18100, webDesign: 24800 },
];
