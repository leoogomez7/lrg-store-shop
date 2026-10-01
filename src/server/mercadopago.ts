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
  paymentDiscount?: number;
  expenses: number;
  profit: number;
  paymentMethod: string;
  installments: number;
  discountCode?: string;
  cardFee: number;
  shippingMethod: string;
  orderId?: string;
  paymentTotal?: number;
  paymentItems?: {
    name: string;
    quantity: number;
    price: number;
    brand?: string;
  }[];
  isGuest?: boolean;
  guestCustomerId?: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    brand?: string;
    paymentMethod?: string;
    shippingMethod?: string;
  }[];
};

function getAccessToken() {
  const token =
    import.meta.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim() ??
    (typeof process !== "undefined" ? process.env["MERCADOPAGO_ACCESS_TOKEN"]?.trim() : undefined);
  if (!token) throw new Error("Falta configurar MERCADOPAGO_ACCESS_TOKEN.");
  return token;
}

async function mercadoPagoGet<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
  });
  if (!response.ok) {
    throw new Error(`Mercado Pago no pudo consultar las cuotas (${response.status}).`);
  }
  return (await response.json()) as T;
}

type MercadoPagoCardOption = { id: string; name: string };

export const getMercadoPagoCardMethods = createServerFn({ method: "POST" })
  .validator((data: Record<string, never>) => data)
  .handler(async () => {
    const paymentTypes = ["credit_card", "debit_card"];
    const responses = await Promise.all(
      paymentTypes.map((paymentType) =>
        mercadoPagoGet<MercadoPagoCardOption[]>(
          `/v1/payment_methods?payment_type_id=${paymentType}`,
        ),
      ),
    );
    const methods = new Map<string, MercadoPagoCardOption>();
    for (const method of responses.flat()) {
      if (method.id && method.name) methods.set(method.id, { id: method.id, name: method.name });
    }
    return Array.from(methods.values()).sort((left, right) => left.name.localeCompare(right.name));
  });

export const getMercadoPagoCardIssuers = createServerFn({ method: "POST" })
  .validator((data: { paymentMethodId: string }) => data)
  .handler(async ({ data }) => {
    const query = new URLSearchParams({ payment_method_id: data.paymentMethodId });
    return mercadoPagoGet<MercadoPagoCardOption[]>(`/v1/payment_methods/issuers?${query}`);
  });

export const getMercadoPagoInstallments = createServerFn({ method: "POST" })
  .validator((data: { amount: number; paymentMethodId: string; issuerId: string }) => {
    if (!Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 100_000_000) {
      throw new Error("El importe para consultar cuotas no es válido.");
    }
    if (!data.paymentMethodId.trim() || !data.issuerId.trim()) {
      throw new Error("Seleccioná la tarjeta y el banco emisor.");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const query = new URLSearchParams({
      amount: data.amount.toFixed(2),
      payment_method_id: data.paymentMethodId,
      "issuer.id": data.issuerId,
    });
    const response = await mercadoPagoGet<
      Array<{
        payer_costs?: Array<{
          installments: number;
          installment_amount: number;
          total_amount: number;
          installment_rate: number;
        }>;
      }>
    >(`/v1/payment_methods/installments?${query}`);
    return (response ?? []).flatMap((method) => method.payer_costs ?? []);
  });

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
        items: (data.payment.paymentItems ?? data.payment.items).map((item) => ({
          title: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          currency_id: "ARS",
        })),
        total_amount: data.payment.paymentTotal ?? data.payment.total,
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
    const intent = await loadPaymentIntent({ data: { id: data.intentId } });
    return {
      status: intent?.status ?? "unknown",
      orderId: intent?.orderId ?? null,
    };
  });
