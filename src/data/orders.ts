import type { BrandSlug } from "@/config/brands";
import { saveAdminOrders } from "@/server/persistence";

export type OrderStatus = "pendiente" | "pagado" | "enviado" | "entregado" | "cancelado";

export type OrderAttachment = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

export type Order = {
  id: string;
  brand: BrandSlug;
  customer: string;
  email: string;
  phone: string;
  extraInfo: string;
  date: string;
  total: number;
  expenses: number;
  profit: number;
  status: OrderStatus;
  deliveryStatus?: "Pendiente" | "Enviado";
  paymentStatus?: "Pendiente" | "Pagado" | "Cancelado";
  paymentMethod: string;
  deliveryDate?: string | undefined;
  shippingMethod?:
    "Por correo fisico" | "Por correo electronico" | "Por Whatsapp" | string | undefined;
  shippingNumber?: string | undefined;
  attachments?: OrderAttachment[];
  items: { name: string; quantity: number; price: number }[];
};

function readStoredOrders(): Order[] {
  return [];
}

export function saveOrders(orders: Order[]) {
  void saveAdminOrders({ data: { orders } });
}

const defaultOrders: Order[] = [];
/*
const legacyDefaultOrders: Order[] = [
  {
    id: "LRG-24810",
    brand: "arcade",
    customer: "Martín Rivas",
    email: "martin.rivas@mail.com",
    phone: "+54 9 11 2345 6789",
    extraInfo: "Preferencia de envío exprés",
    date: "2026-08-02",
    total: 618,
    expenses: 410,
    profit: 208,
    status: "enviado",
    paymentMethod: "Tarjeta",
    deliveryDate: "2026-08-04",
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
    phone: "+54 9 11 9876 5432",
    extraInfo: "Envío a domicilio a nombre de Lucía",
    date: "2026-08-01",
    total: 278,
    expenses: 180,
    profit: 98,
    status: "pagado",
    paymentMethod: "Transferencia",
    deliveryDate: "2026-08-03",
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
    phone: "+54 9 11 5555 1234",
    extraInfo: "Contacto para factura electrónica",
    date: "2026-07-28",
    total: 4900,
    expenses: 3200,
    profit: 1700,
    status: "entregado",
    paymentMethod: "Wise",
    deliveryDate: "2026-07-30",
    items: [{ name: "Tienda Ecommerce Completa", quantity: 1, price: 4900 }],
  },
  {
    id: "LRG-24801",
    brand: "arcade",
    customer: "Sofía Duarte",
    email: "sofia.duarte@mail.com",
    phone: "+54 9 11 2233 4455",
    extraInfo: "Retira en sucursal 3",
    date: "2026-07-26",
    total: 119,
    expenses: 45,
    profit: 74,
    status: "entregado",
    paymentMethod: "Mastercard",
    deliveryDate: "2026-07-26",
    items: [{ name: "PS Plus Premium · 12 meses", quantity: 1, price: 119 }],
  },
  {
    id: "LRG-24796",
    brand: "scents",
    customer: "Iván Molina",
    email: "ivan.molina@mail.com",
    phone: "+54 9 11 3344 5566",
    extraInfo: "Solicita envoltorio de regalo",
    date: "2026-07-22",
    total: 175,
    expenses: 95,
    profit: 80,
    status: "pendiente",
    paymentMethod: "Visa",
    items: [{ name: "Sándalo Blanco Extrait", quantity: 1, price: 175 }],
  },
  {
    id: "LRG-24790",
    brand: "web-design",
    customer: "Aurora Labs",
    email: "team@auroralabs.io",
    phone: "+54 9 11 6677 8899",
    extraInfo: "Requiere reintegrar plan mensual",
    date: "2026-07-18",
    total: 3600,
    expenses: 2200,
    profit: 1400,
    status: "cancelado",
    paymentMethod: "Transferencia",
    items: [{ name: "Dashboard Analítico", quantity: 1, price: 3600 }],
  },
];
*/

export const orders: Order[] = [];

export const revenueByMonth = [
  { month: "Feb", arcade: 12400, scents: 8200, webDesign: 14200 },
  { month: "Mar", arcade: 15100, scents: 9400, webDesign: 16800 },
  { month: "Abr", arcade: 17600, scents: 11200, webDesign: 15400 },
  { month: "May", arcade: 21300, scents: 13800, webDesign: 21900 },
  { month: "Jun", arcade: 24800, scents: 15400, webDesign: 26400 },
  { month: "Jul", arcade: 27900, scents: 18100, webDesign: 24800 },
];
