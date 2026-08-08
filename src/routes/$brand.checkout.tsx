import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CheckCircle2, CreditCard, Lock, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getBrand } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/store/cart";

export const Route = createFileRoute("/$brand/checkout")({
  loader: ({ params }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    return { brandName: brand.name };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Checkout — ${loaderData.brandName}` : "Checkout";
    return {
      meta: [
        { title },
        { name: "description", content: "Completá tus datos y finalizá la compra." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Checkout seguro de LRG Store Shop." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const params = Route.useParams();
  const brand = getBrand(params.brand)!;
  const { items, subtotal, clear } = useCart();
  const shipping = subtotal > 300 || subtotal === 0 ? 0 : 18;
  const [step, setStep] = useState<"form" | "done">("form");
  const [orderId, setOrderId] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.length === 0) {
      toast.error("Tu carrito está vacío");
      return;
    }
    const id = `LRG-${Math.floor(10000 + Math.random() * 89999)}`;
    setOrderId(id);
    clear();
    setStep("done");
    toast.success("Pedido confirmado", { description: `Número ${id}` });
  }

  if (step === "done") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-24 sm:px-6">
        <div className="glass-panel rounded-3xl p-12 text-center">
          <CheckCircle2 className="mx-auto size-12 text-primary" />
          <h1 className="font-display mt-6 text-3xl font-semibold">¡Gracias por tu compra!</h1>
          <p className="mt-3 text-muted-foreground">
            Tu pedido <span className="text-foreground">{orderId}</span> fue confirmado. Te enviamos
            el detalle por correo electrónico.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/$brand/productos" params={{ brand: brand.slug }}>
                Seguir comprando
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/cuenta">Ver mis pedidos</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Checkout</p>
      <h1 className="mt-2 text-3xl font-semibold">Finalizar compra</h1>

      <form onSubmit={submit} className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="glass-panel rounded-2xl p-6">
            <h2 className="font-display flex items-center gap-2 font-semibold">
              <Truck className="size-4 text-primary" /> Datos de envío
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input id="name" required placeholder="Juan Pérez" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required placeholder="juan@mail.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" required placeholder="+54 11 5555 5555" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ciudad</Label>
                <Input id="city" required placeholder="Buenos Aires" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input id="address" required placeholder="Av. Siempre Viva 742" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Notas del pedido (opcional)</Label>
                <Textarea id="notes" placeholder="Indicaciones para la entrega" rows={3} />
              </div>
            </div>
          </section>

          <section className="glass-panel rounded-2xl p-6">
            <h2 className="font-display flex items-center gap-2 font-semibold">
              <CreditCard className="size-4 text-primary" /> Método de pago
            </h2>
            <RadioGroup defaultValue={brand.payments[0] ?? "Tarjeta"} className="mt-5 space-y-3">
              {brand.payments.map((payment) => (
                <label
                  key={payment}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2/60 px-4 py-3 text-sm"
                >
                  <RadioGroupItem value={payment} />
                  {payment}
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
          <ul className="mt-5 space-y-3 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {item.quantity} × {item.name}
                </span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-muted-foreground">No hay productos en el carrito.</li>
            )}
          </ul>
          <Separator className="my-5" />
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Envío</dt>
              <dd>{shipping === 0 ? "Gratis" : formatPrice(shipping)}</dd>
            </div>
          </dl>
          <Separator className="my-5" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-2xl font-semibold">
              {formatPrice(subtotal + shipping)}
            </span>
          </div>
          <Button type="submit" size="lg" className="mt-6 w-full">
            Confirmar pedido
          </Button>
        </aside>
      </form>
    </main>
  );
}
