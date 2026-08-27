import { createFileRoute } from "@tanstack/react-router";
import type { Order } from "@/data/orders";
import { completePaymentIntent, loadPaymentIntent, upsertAdminOrder } from "@/server/persistence";

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

        const accessToken = import.meta.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim();
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

        const payload = JSON.parse(intent.data) as Omit<PaymentIntentData, "id">;
        const id = `LRG-${Math.floor(10000 + Math.random() * 89999)}`;
        const order: Order = {
          ...payload,
          id,
          date: new Date().toISOString().slice(0, 10),
          extraInfo: payload.notes,
          status: "pagado",
          paymentStatus: "Pagado",
        };
        await upsertAdminOrder({ data: { order } });
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
  expenses: number;
  profit: number;
  paymentMethod: string;
  installments: number;
  discountCode?: string;
  cardFee: number;
  shippingMethod: string;
  items: Order["items"];
};
