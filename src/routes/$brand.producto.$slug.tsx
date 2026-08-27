import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, Minus, Plus, Shield, Star, Truck } from "lucide-react";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        variantName: selectedVariant.name,
        price: selectedVariant.price,
        priceCurrency: selectedVariant.priceCurrency ?? product.priceCurrency,
        comision: selectedVariant.comision,
        comisionCurrency: selectedVariant.comisionCurrency,
        gastos: selectedVariant.gastos,
        gastosCurrency: selectedVariant.gastosCurrency,
        description: selectedVariant.description,
        stock: selectedVariant.stock,
        features: selectedVariant.features ?? product.features,
      }
    : product;
  const category = brand.categories.find((item) => item.slug === product.category);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
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
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <div className="glass-panel overflow-hidden rounded-3xl p-4">
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

        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.badge && <Badge>{product.badge}</Badge>}
            {category && <Badge variant="secondary">{category.name}</Badge>}
          </div>
          <h1 className="font-display mt-4 text-3xl font-semibold sm:text-4xl">{product.name}</h1>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="size-4 fill-primary text-primary" />
              {product.rating}
            </span>
            <span>·</span>
            <span>{product.reviews} valoraciones</span>
            <span>·</span>
            <span>{activeProduct.stock > 0 ? `${activeProduct.stock} en stock` : "Sin stock"}</span>
          </div>

          {product.variants && product.variants.length > 0 ? (
            <div className="mt-6 max-w-sm space-y-2">
              <label className="text-sm font-medium" htmlFor="product-variant">
                Elegí una variante
              </label>
              <Select
                value={selectedVariant?.id}
                onValueChange={(value) => {
                  setSelectedVariantId(value);
                  setQuantity(1);
                }}
              >
                <SelectTrigger id="product-variant">
                  <SelectValue placeholder="Seleccionar variante" />
                </SelectTrigger>
                <SelectContent>
                  {product.variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <p className="mt-6 leading-relaxed text-muted-foreground">{activeProduct.description}</p>

          <div className="glass-panel mt-8 rounded-2xl p-6">
            <div className="flex items-end gap-3">
              <span className="font-display text-3xl font-semibold">
                {formatPrice(activeProduct.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
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
              <Button
                size="lg"
                className="flex-1"
                disabled={activeProduct.stock <= 0}
                onClick={() => addProduct(activeProduct, quantity)}
              >
                {activeProduct.stock > 0 ? "Agregar al carrito" : "Sin stock"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => {
                  if (activeProduct.stock <= 0) return;
                  addProduct(activeProduct, quantity);
                  navigate({ to: "/checkout" });
                }}
              >
                Comprar ahora
              </Button>
            </div>

            <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-2">
                <Truck className="size-4 text-primary" /> Envío en 24-72 h
              </li>
              <li className="flex items-center gap-2">
                <Shield className="size-4 text-primary" /> Garantía oficial
              </li>
            </ul>
          </div>

          <Tabs defaultValue="features" className="mt-8">
            <TabsList>
              <TabsTrigger value="features">Características</TabsTrigger>
              <TabsTrigger value="shipping">Envíos</TabsTrigger>
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
            <TabsContent value="shipping" className="pt-4 text-sm text-muted-foreground">
              Despachamos desde {brand.contact.location} con seguimiento incluido. Envío gratis en
              compras superiores a {formatPrice(300)}.
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
