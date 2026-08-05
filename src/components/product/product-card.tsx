import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/common/product-visual";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/store/cart";
import type { Product } from "@/data/products";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addProduct } = useCart();
  const outOfStock = product.stock <= 0;
  const discountPercent = product.compareAtPrice
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;
  const discountLabel = discountPercent > 0 ? `${discountPercent}% OFF` : undefined;
  const deliveryLabel = (() => {
    if (!product.badge) return undefined;
    if (/entrega digital/i.test(product.badge)) return "Entrega inmediata";
    const match = product.badge.match(/entrega\s*(\d+)\s*d[ií]as?/i);
    if (match) return `Entrega ${match[1]} días`;
    return undefined;
  })();

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
      className="glass-panel hover-lift group flex flex-col overflow-hidden rounded-2xl"
    >
      <Link
        to="/$brand/producto/$slug"
        params={{ brand: product.brand, slug: product.slug }}
        className="relative block"
      >
        <ProductVisual
          seed={product.id}
          label={product.name}
          className="aspect-[4/3] transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {discountLabel && (
            <Badge className="glass border-0 text-foreground backdrop-blur">
              {discountLabel}
            </Badge>
          )}
          {deliveryLabel && (
            <Badge className="glass border-0 text-foreground backdrop-blur">
              {deliveryLabel}
            </Badge>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display leading-snug font-semibold">
              <Link
                to="/$brand/producto/$slug"
                params={{ brand: product.brand, slug: product.slug }}
                className="transition-colors hover:text-primary"
              >
                {product.name}
              </Link>
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.short}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Star className="size-3.5 fill-primary text-primary" />
            {product.rating}
          </span>
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          <div>
            <p className="font-display text-xl font-semibold">{formatPrice(product.price)}</p>
            {product.compareAtPrice && (
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </p>
            )}
          </div>
          <Button size="sm" disabled={outOfStock} onClick={() => addProduct(product)}>
            {outOfStock ? "Sin stock" : "Agregar"}
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="aspect-[4/3] animate-pulse bg-surface-2" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-8 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
