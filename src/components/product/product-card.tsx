import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductVisual } from "@/components/common/product-visual";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/store/cart";
import type { Product } from "@/data/products";
import { getFavoriteProductIds, toggleFavoriteProduct } from "@/lib/favorites";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { addProduct } = useCart();
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteOwner, setFavoriteOwner] = useState("guest");
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

  useEffect(() => {
    const owner = window.sessionStorage.getItem("userFullName") || "guest";
    setFavoriteOwner(owner);
    setIsFavorite(getFavoriteProductIds(owner).includes(product.id));
  }, [product.id]);

  return (
    <article
      className="glass-panel hover-lift group flex cursor-pointer flex-col overflow-hidden rounded-2xl"
      role="link"
      tabIndex={0}
      aria-label={`Ver descripción de ${product.name}`}
      onClick={() =>
        navigate({
          to: "/$brand/producto/$slug",
          params: { brand: product.brand, slug: product.slug },
        })
      }
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          navigate({
            to: "/$brand/producto/$slug",
            params: { brand: product.brand, slug: product.slug },
          });
        }
      }}
      style={{
        transition: "transform 500ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms cubic-bezier(0.22, 1, 0.36, 1)",
        opacity: 1,
        transform: "translateY(0)",
      }}
    >
      <div className="relative">
        <Link
          to="/$brand/producto/$slug"
          params={{ brand: product.brand, slug: product.slug }}
          className="relative block"
        >
          <ProductVisual
            seed={product.id}
            label={product.name}
            className="aspect-3/2 transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute left-3 top-3 flex flex-col gap-2">
            {discountLabel && <Badge className="glass border-0 text-foreground backdrop-blur">{discountLabel}</Badge>}
            {deliveryLabel && <Badge className="glass border-0 text-foreground backdrop-blur">{deliveryLabel}</Badge>}
          </div>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={isFavorite ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}
          title={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
          className="absolute right-3 top-3 z-10 rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
          onClick={(event) => {
            event.stopPropagation();
            setIsFavorite(toggleFavoriteProduct(favoriteOwner, product.id).includes(product.id));
          }}
        >
          <Heart className={isFavorite ? "fill-current text-rose-500" : ""} />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div>
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
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            <p className="font-display text-xl font-semibold">{formatPrice(product.price)}</p>
            {product.compareAtPrice && (
              <p className="text-xs text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </p>
            )}
          </div>
          <Button
            size="sm"
            disabled={outOfStock}
            onClick={(event) => {
              event.stopPropagation();
              addProduct(product);
            }}
          >
            {!outOfStock && <ShoppingCart className="size-3.5" aria-hidden="true" />}
            {outOfStock ? "Sin stock" : "Agregar"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="glass-panel overflow-hidden rounded-2xl">
      <div className="aspect-4/3 animate-pulse bg-surface-2" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-8 w-1/2 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}
