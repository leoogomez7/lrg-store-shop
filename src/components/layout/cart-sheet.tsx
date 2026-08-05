import { Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ProductVisual } from "@/components/common/product-visual";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/store/cart";
import type { BrandConfig } from "@/config/brands";

export function CartSheet({ brand, children }: { brand: BrandConfig; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { itemsByBrand, brandSubtotal, setQuantity, removeItem } = useCart();
  const items = itemsByBrand(brand.slug);
  const subtotal = brandSubtotal(brand.slug);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Carrito · {brand.shortName}</SheetTitle>
          <SheetDescription>
            {items.length > 0
              ? `${items.length} ${items.length === 1 ? "producto" : "productos"} en tu carrito`
              : "Todavía no agregaste productos de este sector."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto px-4">
          {items.length === 0 && (
            <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
              <ShoppingBag className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Tu carrito está vacío.</p>
              <Button asChild size="sm" onClick={() => setOpen(false)}>
                <Link to="/$brand/productos" params={{ brand: brand.slug }}>
                  Ver catálogo
                </Link>
              </Button>
            </div>
          )}

          {items.map((item) => (
            <div key={item.id} className="glass flex gap-3 rounded-xl p-3">
              <ProductVisual seed={item.id} label={item.name} className="size-16 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(item.price)}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setQuantity(item.id, item.quantity - 1)}
                    aria-label="Restar unidad"
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-6 text-center text-sm">{item.quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setQuantity(item.id, item.quantity + 1)}
                    aria-label="Sumar unidad"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeItem(item.id)}
                    aria-label="Eliminar producto"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="space-y-3 border-t border-border p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-display text-lg font-semibold">{formatPrice(subtotal)}</span>
            </div>
            <div className="grid gap-2">
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/$brand/checkout" params={{ brand: brand.slug }}>
                  Finalizar compra
                </Link>
              </Button>
              <Button asChild variant="secondary" onClick={() => setOpen(false)}>
                <Link to="/$brand/carrito" params={{ brand: brand.slug }}>
                  Ver carrito completo
                </Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
