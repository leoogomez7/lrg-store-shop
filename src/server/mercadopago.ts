import { createServerFn } from "@tanstack/react-start";
import { createPaymentIntent, loadPaymentIntent } from "@/server/persistence";

export type PaymentIntentData = {
  brand: string;
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
  items: { name: string; quantity: number; price: number }[];
};

function getAccessToken() {
  const token = import.meta.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("Falta configurar MERCADOPAGO_ACCESS_TOKEN.");
  return token;
}

function getPreferenceUrls(returnUrl: string, intentId: string) {
  const baseUrl = new URL(returnUrl).origin;
  const checkoutUrl = `${baseUrl}/checkout`;
  return {
    success: `${checkoutUrl}?payment=success&intent=${intentId}`,
    failure: `${checkoutUrl}?payment=failure&intent=${intentId}`,
    pending: `${checkoutUrl}?payment=pending&intent=${intentId}`,
    webhook: `${baseUrl}/api/mercadopago/webhook`,
  };
}

export const createMercadoPagoPreference = createServerFn({ method: "POST" })
  .validator((data: { intentId: string; payment: PaymentIntentData; returnUrl: string }) => data)
  .handler(async ({ data }) => {
    const intentCreated = await createPaymentIntent({
      data: { id: data.intentId, data: JSON.stringify(data.payment) },
    });
    if (!intentCreated) throw new Error("No se pudo guardar la intención de pago.");

    const urls = getPreferenceUrls(data.returnUrl, data.intentId);
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_reference: data.intentId,
        payer: { name: data.payment.customer, email: data.payment.email },
        items: data.payment.items.map((item) => ({
          title: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          currency_id: "ARS",
        })),
        total_amount: data.payment.total,
        back_urls: {
          success: urls.success,
          failure: urls.failure,
          pending: urls.pending,
        },
        auto_return: "approved",
        notification_url: urls.webhook,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mercado Pago rechazó la preferencia (${response.status}).`);
    }
    const preference = (await response.json()) as { init_point?: string };
    if (!preference.init_point) throw new Error("Mercado Pago no devolvió el link de pago.");
    return { url: preference.init_point };
  });

export const getMercadoPagoIntentStatus = createServerFn({ method: "POST" })
  .validator((data: { intentId: string }) => data)
  .handler(async ({ data }) => {
    const intent = await loadPaymentIntent({ data });
    return {
      status: intent?.status ?? "unknown",
      orderId: intent?.orderId ?? null,
    };
  });
