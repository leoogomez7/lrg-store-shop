import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, CreditCard, Lock, Truck } from "lucide-react";
import { useCart } from "@/store/cart";
import { BrandHeader } from "@/components/layout/brand-header";
import { BrandFooter } from "@/components/layout/brand-footer";
import { getBrand } from "@/config/brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { orderQueries, orderService } from "@/services/catalog.service";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout" },
      { name: "description", content: "Completá tus datos y finalizá la compra." },
      { property: "og:title", content: "Checkout" },
      { property: "og:description", content: "Checkout seguro de LRG Store Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "icon", href: "/LRG Store Shop PNG.png", type: "image/png" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const queryClient = useQueryClient();
  const [step, setStep] = useState("form");
  const [orderId, setOrderId] = useState("");

  // Choose brand from first item in cart if available, otherwise default to web-design
  const firstBrandSlug = items[0]?.brand ?? "web-design";
  const brand = getBrand(firstBrandSlug)!;
  const availablePaymentMethods = (brand.paymentMethods ?? brand.payments.map((name) => ({ id: name, name, enabled: true })))
    .filter((method) => method.enabled);
  const availableShippingMethods = (brand.shipping?.methods ?? [])
    .filter((method) => method.enabled);
  const creditCardMethods = availablePaymentMethods.filter((method) => /visa|mastercard|amex|tarjeta\s+de\s+cr[eé]dito/i.test(method.name));
  const otherPaymentMethods = availablePaymentMethods.filter((method) => !creditCardMethods.includes(method));
  const interestFreeOptions = [1];

  // Ensure header and footer are shown on checkout
  const Header = (
    <BrandHeader brand={brand} headerTheme="theme-webdesign" />
  );

  const shippingThreshold = brand.shipping?.freeShippingThreshold ?? 300;
  const shipping = subtotal > shippingThreshold || subtotal === 0 ? 0 : 18;

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(availablePaymentMethods[0]?.name ?? "Tarjeta");
  const [creditCardOpen, setCreditCardOpen] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const isCreditCardSelected = creditCardMethods.some((payment) => payment.name === paymentMethod);
  const [shippingMethod, setShippingMethod] = useState<string>(availableShippingMethods[0]?.name ?? "");
  const [validationMessage, setValidationMessage] = useState("");
  const validationRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (validationMessage && validationRef.current) {
      validationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      validationRef.current.focus();
    }
  }, [validationMessage]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const missingFields: string[] = [];
    if (!customerName.trim()) missingFields.push("Nombre completo");
    if (!email.trim()) missingFields.push("Email");
    if (!phone.trim()) missingFields.push("Teléfono");
    if (!city.trim()) missingFields.push("Ciudad");
    if (!address.trim()) missingFields.push("Dirección");
    if (!paymentMethod.trim()) missingFields.push("Método de pago");
    if (availableShippingMethods.length > 0 && !shippingMethod.trim()) missingFields.push("Método de envío");

    if (missingFields.length > 0) {
      setValidationMessage(`Faltan completar: ${missingFields.join(", ")}.`);
      return;
    }

    setValidationMessage("");
    if (items.length === 0) return;
    const id = `LRG-${Math.floor(10000 + Math.random() * 89999)}`;
    const total = subtotal + shipping;
    const expenses = Math.round(total * 0.65);
    const order = {
      id,
      brand: brand.slug,
      customer: customerName,
      email,
      phone,
      extraInfo: notes,
      date: new Date().toISOString().slice(0, 10),
      total,
      expenses,
      profit: total - expenses,
      status: "pendiente",
      paymentMethod,
      shippingMethod,
      items: items.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
    };

    orderService.create(order);
    const orderQueryKey = ["orders"] as const;
    queryClient.invalidateQueries({ queryKey: orderQueryKey });
    setOrderId(id);
    clear();
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
        {Header}
        <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-24 sm:px-6">
          <div className="glass-panel rounded-3xl p-12 text-center">
            <CheckCircle2 className="mx-auto size-12 text-primary" />
            <h1 className="font-display mt-6 text-3xl font-semibold">¡Gracias por tu compra!</h1>
            <p className="mt-3 text-muted-foreground">Tu pedido <span className="text-foreground">{orderId}</span> fue confirmado.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/">Seguir comprando</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/cuenta">Ver mis pedidos</Link>
              </Button>
            </div>
          </div>
        </main>
        <BrandFooter brand={brand} />
      </div>
    );
  }

  return (
    <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
      {Header}
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Checkout</p>
            <h1 className="mt-2 text-3xl font-semibold">Finalizar compra</h1>
          </div>
          <Link to="/carrito">
            <Button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50">
              <ArrowLeft className="size-4" /> Volver
            </Button>
          </Link>
        </div>

        <form onSubmit={submit} noValidate className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
          {validationMessage && (
            <div
              ref={validationRef}
              tabIndex={-1}
              className="lg:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 outline-none"
              role="alert"
              aria-live="polite"
            >
              ⚠️ {validationMessage}
            </div>
          )}
          <div className="space-y-6">
            <section className="glass-panel rounded-2xl p-6">
              <h2 className="font-display flex items-center gap-2 font-semibold">
                <Truck className="size-4 text-primary" /> Datos de envío
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input id="name" required placeholder="Juan Pérez" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required placeholder="juan@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" required placeholder="+54 11 5555 5555" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input id="city" required placeholder="Buenos Aires" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input id="address" required placeholder="Av. Siempre Viva 742" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notas del pedido (opcional)</Label>
                  <Textarea id="notes" placeholder="Indicaciones para la entrega" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
            </section>

            {availableShippingMethods.length > 0 && (
              <section className="glass-panel rounded-2xl p-6">
                <h2 className="font-display flex items-center gap-2 font-semibold">
                  <Truck className="size-4 text-primary" /> Método de envío
                </h2>
                <RadioGroup value={shippingMethod} onValueChange={setShippingMethod} className="mt-5 space-y-3">
                  {availableShippingMethods.map((shippingOption) => (
                    <label key={shippingOption.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2/60 px-4 py-3 text-sm">
                      <RadioGroupItem value={shippingOption.name} />
                      {shippingOption.name}
                    </label>
                  ))}
                </RadioGroup>
              </section>
            )}

            <section className="glass-panel rounded-2xl p-6">
              <h2 className="font-display flex items-center gap-2 font-semibold">
                <CreditCard className="size-4 text-primary" /> Método de pago
              </h2>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="mt-5 space-y-3">
                {creditCardMethods.length > 0 && (
                  <div className="rounded-xl bg-surface-2/60 px-4 py-3">
                    <div className="flex items-center gap-3 text-sm">
                      <RadioGroupItem value={creditCardMethods[0].name} />
                      <span className="flex-1">Tarjeta de crédito</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setCreditCardOpen((current) => !current)}
                      >
                        {creditCardOpen ? "Ver menos" : "Ver más"}
                      </Button>
                    </div>
                    {creditCardOpen && (
                      <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                        <p className="text-xs text-muted-foreground">Elegí la tarjeta y la cantidad de cuotas.</p>
                        <div className="space-y-2">
                          {creditCardMethods.map((payment) => (
                            <label key={payment.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm">
                              <RadioGroupItem value={payment.name} />
                              {payment.name}
                            </label>
                          ))}
                        </div>
                        {creditCardMethods.some((payment) => payment.name === paymentMethod) && interestFreeOptions.length > 1 && (
                          <div className="space-y-2">
                            <Label>Cantidad de cuotas</Label>
                            <div className="grid gap-2 sm:grid-cols-3">
                              {interestFreeOptions.map((installments) => (
                                <label key={installments} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                                  <input
                                    type="radio"
                                    name="installments"
                                    checked={selectedInstallments === installments}
                                    onChange={() => setSelectedInstallments(installments)}
                                  />
                                  {installments === 1 ? "1 pago" : `${installments} cuotas`}
                                </label>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {otherPaymentMethods.map((payment) => (
                  <label key={payment.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2/60 px-4 py-3 text-sm">
                    <RadioGroupItem value={payment.name} />
                    {payment.name}
                  </label>
                ))}
              </RadioGroup>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Demostración: no se procesan pagos reales.
              </p>
            </section>
          </div>

          <aside className="glass-panel h-fit rounded-2xl p-6 lg:sticky lg:top-24">
            <h2 className="font-display font-semibold">Tu pedido</h2>
            <div className="mt-5 space-y-3 text-sm">
              {items.map((item) => {
                const appliedInstallments = isCreditCardSelected ? selectedInstallments : 1;
                return appliedInstallments > 1 ? (
                  <div key={item.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.name} · {appliedInstallments} cuotas sin interés</span>
                    <span>{formatPrice((item.price * item.quantity) / appliedInstallments)}</span>
                  </div>
                ) : null;
              })}
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Envío estimado</span>
                <span>{shipping === 0 ? "Gratis" : formatPrice(shipping)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span>Total</span>
                <span>{formatPrice(subtotal + shipping)}</span>
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">Confirmar pedido</Button>
            </div>
          </aside>
        </form>
      </main>
      <BrandFooter brand={brand} />
    </div>
  );
}
