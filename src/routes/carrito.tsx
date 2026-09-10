import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CreditCard,
  Eraser,
  Minus,
  Package,
  Plus,
  ShoppingBag,
  Tag,
  X,
} from "lucide-react";
import { useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { LoadingState } from "@/components/common/loading-state";
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
import { useCart } from "@/store/cart-context";
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
  const { items, hydrated, subtotal, setQuantity, removeItem, clear } = useCart();
  const couponBrand = getBrand(items[0]?.brand ?? webDesignConfig.slug) ?? webDesignConfig;
  const [couponCode, setCouponCode] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return JSON.parse(window.localStorage.getItem("lrg_checkout_coupon") ?? "{}").code ?? "";
    } catch {
      return "";
    }
  });
  const [couponApplied, setCouponApplied] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(JSON.parse(window.localStorage.getItem("lrg_checkout_coupon") ?? "{}").applied);
    } catch {
      return false;
    }
  });
  const [couponPercentage, setCouponPercentage] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return Number(JSON.parse(window.localStorage.getItem("lrg_checkout_coupon") ?? "{}").percentage) || 0;
    } catch {
      return 0;
    }
  });
  const [couponMessage, setCouponMessage] = useState("");
  const discountedSubtotal = couponApplied
    ? subtotal * (1 - couponPercentage / 100)
    : subtotal;

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

          {!hydrated ? (
            <div className="mt-12">
              <LoadingState label="Cargando tu carrito..." />
            </div>
          ) : items.length === 0 ? (
            <div className="glass-panel mt-12 flex flex-col items-center gap-4 rounded-3xl p-16 text-center">
              <ShoppingBag className="size-10 text-muted-foreground" />
              <h2 className="font-display text-xl font-semibold">Tu carrito está vacío</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Agregá productos y volvé para finalizar tu compra.
              </p>
              <Button asChild>
                <Link to="/productos">
                  <Package className="size-4" /> Explorar productos
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
              <section className="space-y-4">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className="glass-panel relative flex flex-wrap gap-4 rounded-2xl p-4"
                  >
                    <Link
                      to="/$brand/producto/$slug"
                      params={{ brand: item.brand, slug: item.slug }}
                      aria-label={`Ver ${item.name}`}
                      className="shrink-0 transition-opacity hover:opacity-80"
                    >
                      <ProductVisual
                        seed={item.id}
                        label={item.name}
                        image={item.image}
                        className="size-24 rounded-xl"
                      />
                    </Link>
                    <div className="min-w-50 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-surface-2 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {getBrand(item.brand)?.shortName ?? item.brand}
                        </span>
                      </div>
                      <Link
                        to="/$brand/producto/$slug"
                        params={{ brand: item.brand, slug: item.slug }}
                        className="group block w-fit pl-2"
                      >
                        <h2 className="font-display font-semibold group-hover:text-primary">
                          {item.name}
                        </h2>
                      </Link>
                      {item.variantName && (
                        <span className="mt-1 flex w-fit rounded-full border border-border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {item.variantName}
                        </span>
                      )}
                      <p className="mt-1 pl-2 text-sm text-muted-foreground">
                        {formatPrice(item.price)} ·{" "}
                        {item.stockUnlimited ? "∞ Stock ilimitado" : `${item.stock} disponibles`}
                      </p>

                    </div>
                    <div className="ml-auto flex w-32 shrink-0 flex-col items-center gap-2 pr-0 pt-8 sm:w-36">
                      <p className="font-display text-center text-lg font-semibold">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                      <div className="flex max-w-full items-center gap-0.5 rounded-full border border-border bg-background/70 p-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
                          onClick={() => setQuantity(item.id, item.quantity - 1)}
                          aria-label="Restar unidad"
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="size-4" />
                        </Button>
                        <input
                          type="number"
                          min={1}
                          max={item.stockUnlimited ? undefined : item.stock}
                          value={item.quantity}
                          onChange={(event) => {
                            const nextQuantity = Number(event.target.value);
                            if (!Number.isFinite(nextQuantity)) return;
                            const limitedQuantity = item.stockUnlimited
                              ? Math.max(1, nextQuantity)
                              : Math.min(Math.max(1, nextQuantity), item.stock);
                            setQuantity(item.id, limitedQuantity);
                          }}
                          className="quantity-input h-7 w-8 rounded-lg border-0 bg-transparent text-center text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                          aria-label={`Cantidad de ${item.name}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-full"
                          onClick={() => {
                            if (!item.stockUnlimited && item.quantity >= item.stock) {
                              toast.error("No hay más stock disponible para agregar.", {
                                description: `${item.name} alcanzó su límite de stock.`,
                              });
                              return;
                            }
                            setQuantity(item.id, item.quantity + 1);
                          }}
                          aria-label="Sumar unidad"
                        >
                          <Plus className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-1 size-8 rounded-full text-white hover:border-red-500 hover:bg-red-500/10 hover:text-white"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `Eliminar "${item.name}" del carrito?`,
                          description: undefined,
                          onConfirm: () => removeItem(item.id),
                        })
                      }
                      aria-label={`Eliminar ${item.name}`}
                      title="Eliminar"
                    >
                      <X className="size-4" />
                    </Button>
                  </article>
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
                  onClick={clear}
                >
                  <Eraser className="size-4" />
                  Vaciar carrito
                </Button>
              </section>

              <aside className="glass-panel h-fit rounded-2xl p-6 lg:sticky lg:top-24">
                <section className="mb-6 border-b border-border/60 pb-6">
                  <h2 className="font-display flex items-center gap-2 font-semibold">
                    <Tag className="size-4 text-primary" /> Descuento
                  </h2>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      aria-label="Código de descuento"
                      placeholder="Código de descuento"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value);
                        setCouponMessage("");
                      }}
                      className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const matchingCoupon = (couponBrand.discounts ?? []).find(
                          (discount) =>
                            discount.enabled &&
                            discount.code === couponCode.trim().toUpperCase(),
                        );
                        const isValid = Boolean(matchingCoupon);
                        const percentage = matchingCoupon?.percentage ?? 0;
                        setCouponApplied(isValid);
                        setCouponPercentage(percentage);
                        setCouponMessage(
                          isValid
                            ? `Código aplicado: ${percentage}% de descuento.`
                            : "El código no es válido.",
                        );
                        if (typeof window !== "undefined") {
                          if (isValid) {
                            window.localStorage.setItem(
                              "lrg_checkout_coupon",
                              JSON.stringify({
                                code: couponCode.trim().toUpperCase(),
                                percentage,
                                applied: true,
                              }),
                            );
                          } else {
                            window.localStorage.removeItem("lrg_checkout_coupon");
                          }
                        }
                      }}
                    >
                      Aplicar
                    </Button>
                  </div>
                  {couponMessage && (
                    <p
                      className={`mt-2 text-xs ${couponApplied ? "text-green-600" : "text-destructive"}`}
                    >
                      {couponMessage}
                    </p>
                  )}
                </section>
                <h2 className="font-display font-semibold">Resumen</h2>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Envío</dt>
                    <dd>Elegir en checkout</dd>
                  </div>
                  {couponApplied && (
                    <div className="flex justify-between text-green-600">
                      <dt>Descuento ({couponPercentage}%)</dt>
                      <dd>-{formatPrice((subtotal * couponPercentage) / 100)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-foreground">
                    <dt>Total</dt>
                    <dd>{formatPrice(discountedSubtotal)}</dd>
                  </div>
                  <div className="mt-4">
                    <Link to="/checkout">
                      <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                        <CreditCard className="size-4" />
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
