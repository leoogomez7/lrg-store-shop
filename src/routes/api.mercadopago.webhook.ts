import { createFileRoute } from "@tanstack/react-router";
import type { Order } from "@/data/orders";
import {
  completePaymentIntent,
  completeReservedStockOrder,
  loadPaymentIntent,
} from "@/server/persistence";

export const Route = createFileRoute("/api/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const notification = (await request.json()) as {
          type?: string;
          action?: string;
          data?: { id?: string };
        };
        if (notification.type !== "payment" || !notification.data?.id) {
          return new Response(null, { status: 204 });
        }

        const accessToken =
          import.meta.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim() ??
          (typeof process !== "undefined"
            ? process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim()
            : undefined);
        if (!accessToken)
          return new Response("Payment provider is not configured", { status: 500 });

        const paymentResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${notification.data.id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!paymentResponse.ok) return new Response("Unable to verify payment", { status: 502 });

        const payment = (await paymentResponse.json()) as {
          status?: string;
          external_reference?: string;
        };
        if (payment.status !== "approved" || !payment.external_reference) {
          return new Response(null, { status: 204 });
        }

        const intent = await loadPaymentIntent({ data: { id: payment.external_reference } });
        if (!intent || intent.status === "approved") return new Response(null, { status: 204 });

        const payload = JSON.parse(intent.data) as Omit<PaymentIntentData, "id"> & {
          orderId?: string;
        };
        const id = payload.orderId ?? `LRG-${Math.floor(10000 + Math.random() * 89999)}`;
        const { reservationOwnerId, ...paymentOrder } = payload;
        const order: Order = {
          ...paymentOrder,
          id,
          date: new Date().toISOString().slice(0, 10),
          extraInfo: payload.notes,
          status: "pagado",
          deliveryStatus: "Pendiente",
          paymentStatus: "Pagado",
        };
        const completedOrder = await completeReservedStockOrder({
          data: { ownerId: reservationOwnerId, order },
        });
        if (!completedOrder.ok) {
          console.error("Pago aprobado sin reserva de stock válida:", id, completedOrder.reason);
          return new Response("Stock reservation expired before payment confirmation", {
            status: 409,
          });
        }
        await completePaymentIntent({
          data: { id: payment.external_reference, orderId: id },
        });
        return new Response(null, { status: 204 });
      },
    },
  },
});

type PaymentIntentData = {
  brand: Order["brand"];
  customer: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  total: number;
  paymentDiscount?: number;
  expenses: number;
  profit: number;
  paymentMethod: string;
  installments: number;
  discountCode?: string;
  cardFee: number;
  shippingMethod: string;
  paymentTotal?: number;
  paymentItems?: {
    name: string;
    quantity: number;
    price: number;
    brand?: string;
  }[];
  isGuest?: boolean;
  guestCustomerId?: string;
  reservationOwnerId: string;
  items: Order["items"];
};
