import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag, ShoppingCart, Truck } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/data/products";
import { ProductVisual } from "@/components/common/product-visual";
import { SectionHeading } from "@/components/common/section-heading";
import { ProductCard } from "@/components/product/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBrand } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { catalogQueries } from "@/services/catalog.service";
import { useCart } from "@/store/cart";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/$brand/producto/$slug")({
  loader: async ({ params, context }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    const product = await context.queryClient.ensureQueryData(
      catalogQueries.detail(brand.slug, params.slug),
    );
    if (!product) throw notFound();
    await context.queryClient.ensureQueryData(catalogQueries.related(brand.slug, params.slug));
    return {
      name: product.name,
      short: product.short,
      brandName: brand.name,
      favicon: brand.favicon,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Producto no disponible" }, { name: "robots", content: "noindex" }],
      };
    }
    return {
      meta: [
        { title: loaderData.brandName },
        { name: "description", content: loaderData.short },
        { property: "og:title", content: `${loaderData.name} — LRG Store Shop` },
        { property: "og:description", content: loaderData.short },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        {
          rel: "icon",
          href: loaderData.favicon ?? "/LRG Store Shop PNG.png",
          type: "image/png",
        },
      ],
    };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const params = Route.useParams();
  const brand = getBrand(params.brand)!;
  const { data: product } = useSuspenseQuery(catalogQueries.detail(brand.slug, params.slug));
  const { data: related } = useSuspenseQuery(catalogQueries.related(brand.slug, params.slug));
  const { addProduct } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    product?.variants?.[0]?.id,
  );
  const navigate = useNavigate();

  if (!product) return null;
  const selectedVariant =
    product.variants?.find((variant) => variant.id === selectedVariantId) ?? product.variants?.[0];

  const activeProduct = selectedVariant
    ? {
        ...product,
        id: `${product.id}::${selectedVariant.id}`,
        price: selectedVariant.price,
        description: selectedVariant.description,
        stock: selectedVariant.stock,
        features: selectedVariant.features ?? product.features,
        ...(selectedVariant.priceCurrency ? { priceCurrency: selectedVariant.priceCurrency } : {}),
        ...(selectedVariant.comision !== undefined ? { comision: selectedVariant.comision } : {}),
        ...(selectedVariant.comisionCurrency
          ? { comisionCurrency: selectedVariant.comisionCurrency }
          : {}),
        ...(selectedVariant.gastos !== undefined ? { gastos: selectedVariant.gastos } : {}),
        ...(selectedVariant.gastosCurrency ? { gastosCurrency: selectedVariant.gastosCurrency } : {}),
      }
    : product;
  const category = brand.categories.find((item) => item.slug === product.category);
  const selectedSubcategory = category?.subcategories?.find((item) => item.slug === product.subcategory);
  const freeShippingThreshold = brand.shipping?.freeShippingThreshold ?? 0;

  const deliveryUnit = selectedVariant?.deliveryUnit ?? product.deliveryUnit ?? "inmediata";
  const deliveryAmount = selectedVariant?.deliveryAmount ?? product.deliveryAmount ?? 0;

  const deliveryText = (() => {
    if (deliveryUnit === "inmediata") {
      return "Entrega inmediata";
    }

    if (deliveryUnit === "horas" && deliveryAmount) {
      return `Entrega en ${deliveryAmount} horas`;
    }

    if (deliveryUnit === "dias" && deliveryAmount) {
      return `Entrega en ${deliveryAmount} días`;
    }

    return "";
  })();
  const freeShippingText =
    freeShippingThreshold > 0 ? ` - Envío gratis desde ${formatPrice(freeShippingThreshold)}` : "";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-10 pt-20 sm:px-6">
      <div className="mb-4 flex items-center justify-start">
        <Link
          to="/$brand/productos"
          params={{ brand: brand.slug }}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>Volver</span>
        </Link>
      </div>

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/$brand" params={{ brand: brand.slug }}>
                {brand.shortName}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/$brand/productos" params={{ brand: brand.slug }}>
                Catálogo
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {category && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/$brand/productos" params={{ brand: brand.slug }} search={{ categoria: category.slug }}>
                    {category.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {selectedSubcategory && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/$brand/productos" params={{ brand: brand.slug }} search={{ categoria: category?.slug, subcategoria: selectedSubcategory.slug }}>
                    {selectedSubcategory.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(440px,0.95fr)_minmax(420px,1.05fr)]">
        <div className="overflow-hidden rounded-3xl p-2">
          {product.images && product.images.length > 0 ? (
            <div>
              <img
                src={product.images[0]}
                alt={`${product.name} portada`}
                className="aspect-4/3 w-full rounded-2xl object-cover"
              />
              {product.images.length > 1 && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {product.images.slice(1).map((image, index) => (
                    <img
                      key={`${image}-${index}`}
                      src={image}
                      alt={`${product.name} imagen ${index + 2}`}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <ProductVisual
                seed={product.id}
                label={product.name}
                className="aspect-square rounded-2xl"
              />
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[1, 2, 3].map((index) => (
                  <ProductVisual
                    key={index}
                    seed={`${product.id}-${index}`}
                    label={product.name}
                    className="aspect-square rounded-xl"
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="pl-0 lg:pl-3">
          <div className="flex flex-wrap items-center gap-2">
            {product.badge && <Badge>{product.badge}</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {category && (
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category.name}
              </span>
            )}
            {selectedSubcategory && (
              <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-foreground">
                {selectedSubcategory.name}
              </span>
            )}
          </div>
          <h1 className="font-display mt-4 text-3xl font-semibold sm:text-4xl">{product.name}</h1>
          {(deliveryText || freeShippingText) && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Truck className="size-4 text-primary" />
                {deliveryText}
                {freeShippingText}
              </span>
            </div>
          )}

          {product.variants && product.variants.length > 1 ? (
            <div className="mt-5 max-w-xl">
              <div className="flex flex-wrap gap-2">
                {product.variants.map((variant) => (
                  <button
                    key={variant.id}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      selectedVariantId === variant.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-accent"
                    }`}
                    onClick={() => {
                      setSelectedVariantId(variant.id);
                      setQuantity(1);
                    }}
                  >
                    {variant.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-6 leading-relaxed text-muted-foreground">{activeProduct.description}</p>

          <div className="mt-8 rounded-2xl p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex min-w-37.5 flex-col items-start gap-2">
                <span className="font-display text-3xl font-semibold leading-none">
                  {formatPrice(activeProduct.price)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(product.compareAtPrice)}
                  </span>
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  {activeProduct.stock > 0 ? `${activeProduct.stock} en stock` : "Sin stock"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-2">
                <div className="glass flex items-center gap-1 rounded-xl p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    aria-label="Restar unidad"
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="w-8 text-center text-sm">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => setQuantity((value) => Math.min(activeProduct.stock, value + 1))}
                    aria-label="Sumar unidad"
                    disabled={activeProduct.stock <= 0}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-start gap-2">
              <Button
                size="lg"
                className="w-full max-w-44 gap-2"
                disabled={activeProduct.stock <= 0}
                onClick={() => addProduct(activeProduct, quantity)}
              >
                <ShoppingCart className="size-4" />
                {activeProduct.stock > 0 ? "Agregar al carrito" : "Sin stock"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full max-w-44 gap-2"
                onClick={() => {
                  if (activeProduct.stock <= 0) return;
                  addProduct(activeProduct, quantity);
                  navigate({ to: "/checkout" });
                }}
              >
                <ShoppingBag className="size-4" />
                Comprar ahora
              </Button>
            </div>
          </div>

          <Tabs defaultValue="features" className="mt-8">
            <TabsList>
              <TabsTrigger value="features">Características</TabsTrigger>
              <TabsTrigger value="payments">Pagos</TabsTrigger>
            </TabsList>
            <TabsContent value="features" className="pt-4">
              <ul className="grid gap-2.5 text-sm">
                {activeProduct.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="payments" className="pt-4">
              <div className="flex flex-wrap gap-2">
                {brand.payments.map((payment) => (
                  <span key={payment} className="glass rounded-md px-2.5 py-1 text-xs">
                    {payment}
                  </span>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <SectionHeading eyebrow="También te puede gustar" title="Productos relacionados" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item, index) => (
              <ProductCard key={item.id} product={item} index={index} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
