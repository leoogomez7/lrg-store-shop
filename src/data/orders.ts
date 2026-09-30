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
  document?: string;
  isGuest?: boolean;
  guestCustomerId?: string;
  city?: string;
  street?: string;
  streetNumber?: string;
  floor?: string;
  apartment?: string;
  province?: string;
  postalCode?: string;
  extraInfo: string;
  date: string;
  total: number;
  paymentDiscount?: number;
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
  paymentReceipts?: OrderAttachment[];
  items: {
    productId?: string;
    variantId?: string;
    variantName?: string;
    name: string;
    quantity: number;
    price: number;
    priceCurrency?: "ARS" | "USD";
    gastos?: number;
    gastosCurrency?: "ARS" | "USD";
    usdRate?: number;
    brand?: BrandSlug;
    paymentMethod?: string;
    shippingMethod?: string;
    supplier?: { name: string; phone: string; social: string };
    paymentStatus?: "Pendiente" | "Pagado" | "Cancelado";
    deliveryStatus?: "Pendiente" | "Enviado";
  }[];
};

export function saveOrders(orders: Order[]) {
  return saveAdminOrders({ data: { orders } });
}

export const orders: Order[] = [];
