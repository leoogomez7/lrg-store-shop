import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ProductVisual } from "@/components/common/product-visual";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getBrand } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/store/cart";

export const Route = createFileRoute("/$brand/carrito")({
  loader: ({ params }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    return { brandName: brand.name };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Carrito — ${loaderData.brandName}` : "Carrito";
    return {
      meta: [
        { title },
        { name: "description", content: "Revisá los productos de tu carrito antes de pagar." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Revisá tu carrito en LRG Store Shop." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: CartPage,
});

function CartPage() {
  const params = Route.useParams();
  const brand = getBrand(params.brand)!;
  const { itemsByBrand, brandSubtotal, setQuantity, removeItem, clearBrand } = useCart();
  const items = itemsByBrand(brand.slug);
  const subtotal = brandSubtotal(brand.slug);
  const shipping = subtotal > 300 || subtotal === 0 ? 0 : 18;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Carrito</p>
          <h1 className="mt-2 text-3xl font-semibold">{brand.name}</h1>
        </div>
        <Button asChild variant="ghost" className="gap-2">
          <Link to="/$brand/productos" params={{ brand: brand.slug }}>
            <ArrowLeft className="size-4" /> Seguir comprando
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="glass-panel mt-12 flex flex-col items-center gap-4 rounded-3xl p-16 text-center">
          <ShoppingBag className="size-10 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">Tu carrito está vacío</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Agregá productos de {brand.shortName} y volvé para finalizar tu compra.
          </p>
          <Button asChild>
            <Link to="/$brand/productos" params={{ brand: brand.slug }}>
              Ver catálogo
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="glass-panel flex flex-wrap gap-4 rounded-2xl p-4">
                <ProductVisual
                  seed={item.id}
                  label={item.name}
                  className="size-24 rounded-xl"
                />
                <div className="min-w-[200px] flex-1">
                  <h2 className="font-display font-semibold">{item.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPrice(item.price)} · {item.stock} disponibles
                  </p>
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setQuantity(item.id, item.quantity - 1)}
                      aria-label="Restar unidad"
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => setQuantity(item.id, item.quantity + 1)}
                      aria-label="Sumar unidad"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 gap-1.5 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="size-3.5" /> Quitar
                    </Button>
                  </div>
                </div>
                <p className="font-display self-center text-lg font-semibold">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </article>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => clearBrand(brand.slug)}
            >
              Vaciar carrito
            </Button>
          </section>

          <aside className="glass-panel h-fit rounded-2xl p-6 lg:sticky lg:top-24">
            <h2 className="font-display font-semibold">Resumen</h2>
            <dl className="mt-5 space-y-3 text-sm">
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
            <Button asChild size="lg" className="mt-6 w-full">
              <Link to="/$brand/checkout" params={{ brand: brand.slug }}>
                Ir al checkout
              </Link>
            </Button>
          </aside>
        </div>
      )}
    </main>
  );
}
