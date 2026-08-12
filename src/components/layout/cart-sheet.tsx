import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { cloneElement, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProductVisual } from "@/components/common/product-visual";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/store/cart";
import { getBrand } from "@/config/brands";
import type { BrandConfig } from "@/config/brands";

export function CartSheet({
  brand,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  brand: BrandConfig;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const { items, setQuantity, removeItem } = useCart();
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const freeShippingThreshold = brand.shipping?.freeShippingThreshold ?? 300;
  const shippingCost = items.length > 0 ? (subtotal > freeShippingThreshold ? 0 : 12.5) : 0;
  const total = subtotal + shippingCost;

  const handleOpenChange = (next: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: undefined, onConfirm: () => {} });

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleOpenChange(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        handleOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const triggerElement = children as ReactElement;
  const triggerProps = {
    ref: triggerRef,
    "aria-expanded": open,
    "aria-haspopup": "dialog",
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      triggerElement.props.onClick?.(event);
      if (!event.defaultPrevented) {
        handleOpenChange(!open);
      }
    },
  };

  return (
    <>
      {cloneElement(triggerElement, triggerProps)}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => handleOpenChange(false)} />
          <div
            ref={panelRef}
            className="relative z-10 flex h-full w-full max-w-lg flex-col rounded-3xl border border-border bg-surface/95 p-6 shadow-2xl shadow-black/10 touch-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Carrito de compras"
          >
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Tu carrito</h2>
                <p className="text-sm text-muted-foreground">
                  {items.length > 0
                    ? `${items.length} ${items.length === 1 ? "producto" : "productos"} seleccionado${items.length === 1 ? "" : "s"}`
                    : "Todavía no agregaste productos a tu carrito."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
                  Todos los sectores
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground"
                  onClick={() => handleOpenChange(false)}
                  aria-label="Cerrar carrito"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden rounded-4xl border border-border bg-surface p-4 touch-auto">
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto pr-1 touch-auto">
                  {items.length === 0 ? (
                    <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border/60 bg-background p-8 text-center">
                      <ShoppingBag className="size-10 text-muted-foreground" />
                      <div>
                        <p className="text-lg font-semibold text-foreground">Carrito vacío</p>
                        <p className="text-sm text-muted-foreground">Agrega productos y revisa todo antes de pagar.</p>
                      </div>
                      <Button asChild size="sm" onClick={() => handleOpenChange(false)}>
                        <Link to="/$brand/productos" params={{ brand: brand.slug }}>
                          Ver catálogo
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item) => (
                        <div key={item.id} className="group flex gap-4 rounded-3xl border border-border bg-surface-2 p-4 shadow-sm transition hover:border-primary/60">
                          <ProductVisual seed={item.id} label={item.name} className="h-20 w-20 rounded-3xl" />
                          <div className="min-w-0 flex-1">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-background px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {getBrand(item.brand)?.shortName ?? item.brand}
                              </span>
                              <span className="text-xs font-medium text-muted-foreground">Stock {item.stock}</span>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-foreground">{item.name}</p>
                                <p className="text-sm text-muted-foreground">{formatPrice(item.price)} por unidad</p>
                              </div>
                              <span className="text-sm font-semibold text-foreground">{formatPrice(item.price * item.quantity)}</span>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">Cantidad: {item.quantity}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 min-w-[2.5rem] rounded-full"
                                onClick={() => setQuantity(item.id, item.quantity - 1)}
                                aria-label="Restar unidad"
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="size-4" />
                              </Button>
                              <span className="inline-flex min-w-[2rem] justify-center rounded-full bg-surface px-2 py-1 text-sm font-medium text-foreground">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 min-w-[2.5rem] rounded-full"
                                onClick={() => setQuantity(item.id, item.quantity + 1)}
                                aria-label="Sumar unidad"
                                disabled={item.quantity >= item.stock}
                              >
                                <Plus className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="ml-auto text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  setConfirmState({
                                    open: true,
                                    title: `Eliminar "${item.name}" del carrito?`,
                                    description: undefined,
                                    onConfirm: () => removeItem(item.id),
                                  })
                                }
                                aria-label="Eliminar producto"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                            {item.quantity >= item.stock && (
                              <p className="mt-2 text-xs font-medium text-destructive">No hay más stock disponible para agregar.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {items.length > 0 && (
              <div className="space-y-4 border-t border-border/70 p-4">
                <div className="grid gap-3 rounded-3xl bg-surface p-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Envío estimado</span>
                    <span>{shippingCost === 0 ? "Gratis" : formatPrice(shippingCost)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>Total</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="flex-1">
                    <Link to="/$brand/checkout" params={{ brand: brand.slug }}>
                      Finalizar compra
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" className="flex-1">
                    <Link to="/$brand/carrito" params={{ brand: brand.slug }}>
                      Ver carrito completo
                    </Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Puedes cambiar cantidades desde el carrito antes de pagar.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : null}
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
