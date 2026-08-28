import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ShoppingBag, Trash2 } from "lucide-react";
import { useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { getBrand } from "@/config/brands";
import { BrandHeader } from "@/components/layout/brand-header";
import { BrandFooter } from "@/components/layout/brand-footer";
import { brandList } from "@/config/brands";
import { webDesignConfig } from "@/config/brands/web-design.config";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/store/cart";
import { toast } from "sonner";

export const Route = createFileRoute("/carrito")({
  head: () => ({
    meta: [
      { title: "Carrito" },
      { name: "description", content: "Revisá los productos de tu carrito antes de pagar." },
      { property: "og:title", content: "Carrito" },
      { property: "og:description", content: "Revisá tu carrito en LRG Store Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "icon", href: "/LRG Store Shop PNG.png", type: "image/png" }],
  }),
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { items, subtotal, setQuantity, removeItem, clear } = useCart();

  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    description: undefined as string | undefined,
    onConfirm: () => {},
  });

  return (
    <>
      <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
        <BrandHeader
          brand={webDesignConfig}
          displayBrandName="LRG Store Shop"
          logoBrandSlug="store-shop"
        />

        <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Carrito</p>
              <h1 className="mt-1 text-4xl font-semibold text-white">LRG Store Shop</h1>
            </div>

            <div className="flex items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50">
                    <ArrowLeft className="size-4" /> Seguir comprando
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {brandList.map((b) => (
                    <DropdownMenuItem
                      key={b.slug}
                      onSelect={() => {
                        navigate({ to: `/$brand/productos`, params: { brand: b.slug } });
                      }}
                    >
                      Comprar en {b.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="glass-panel mt-12 flex flex-col items-center gap-4 rounded-3xl p-16 text-center">
              <ShoppingBag className="size-10 text-muted-foreground" />
              <h2 className="font-display text-xl font-semibold">Tu carrito está vacío</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Agregá productos y volvé para finalizar tu compra.
              </p>
              <Button asChild>
                <Link to="/">Ver catálogo</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
              <section className="space-y-4">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="glass-panel flex flex-wrap gap-4 rounded-2xl p-4"
                  >
                    <ProductVisual
                      seed={item.id}
                      label={item.name}
                      className="size-24 rounded-xl"
                    />
                    <div className="min-w-50 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-surface-2 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {getBrand(item.brand)?.shortName ?? item.brand}
                        </span>
                      </div>
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
                          disabled={item.quantity <= 1}
                        >
                          -
                        </Button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            if (item.quantity >= item.stock) {
                              toast.error("No hay más stock disponible para agregar.", {
                                description: `${item.name} alcanzó su límite de stock.`,
                              });
                              return;
                            }
                            setQuantity(item.id, item.quantity + 1);
                          }}
                          aria-label="Sumar unidad"
                        >
                          +
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2 gap-1.5 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Eliminar "${item.name}" del carrito?`,
                              description: undefined,
                              onConfirm: () => removeItem(item.id),
                            })
                          }
                        >
                          <Trash2 className="size-4" />
                          <span className="hidden sm:inline">Eliminar</span>
                        </Button>
                      </div>
                    </div>
                    <p className="font-display self-center text-lg font-semibold">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </article>
                ))}

                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clear}>
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
                    <dd>Acordar entrega</dd>
                  </div>
                  <div className="flex justify-between font-semibold text-foreground">
                    <dt>Total</dt>
                    <dd>{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="mt-4">
                    <Link to="/checkout">
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                        Ir a checkout
                      </Button>
                    </Link>
                  </div>
                </dl>
              </aside>
            </div>
          )}
        </main>

        <BrandFooter brand={webDesignConfig} section="store-shop" />
      </div>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(v) => setConfirmState((s) => ({ ...s, open: v }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          try {
            confirmState.onConfirm();
          } finally {
            setConfirmState((s) => ({ ...s, open: false }));
          }
        }}
      />
    </>
  );
}
