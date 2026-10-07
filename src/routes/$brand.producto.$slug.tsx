import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import type { Product } from "@/data/products";
import type { BrandSubcategory } from "@/config/brands";
import { CroppedProductImage, ProductVisual } from "@/components/common/product-visual";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { applyAdminSettings, getBrand, refreshBrandData } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { getProductVariantIdentityFromPublicSlug } from "@/lib/product-slug";
import { catalogQueries } from "@/services/catalog.service";
import { useCart } from "@/store/cart-context";
import { useNavigate } from "@tanstack/react-router";

const formatInstallmentPrice = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);

const INSTALLMENT_REFERENCE_PRICE = 35_150.9;
const INTEREST_BEARING_REFERENCE_PLANS = [
  { installments: 9, installmentAmount: 5_603.44, totalAmount: 50_431 },
  { installments: 12, installmentAmount: 4_551.75, totalAmount: 54_620.98 },
] as const;

function calculateInstallmentPlans(priceWithSurcharge: number) {
  if (!Number.isFinite(priceWithSurcharge) || priceWithSurcharge < 0) return [];

  const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const noInterestPlans = [1, 2, 3, 6].map((installments) => ({
    installments,
    installmentAmount: roundCurrency(priceWithSurcharge / installments),
    totalAmount: roundCurrency(priceWithSurcharge),
    interestFree: true,
  }));
  const interestPlans = INTEREST_BEARING_REFERENCE_PLANS.map((plan) => ({
    installments: plan.installments,
    installmentAmount: roundCurrency(
      (priceWithSurcharge * plan.installmentAmount) / INSTALLMENT_REFERENCE_PRICE,
    ),
    totalAmount: roundCurrency(
      (priceWithSurcharge * plan.totalAmount) / INSTALLMENT_REFERENCE_PRICE,
    ),
    interestFree: false,
  }));

  return [...noInterestPlans, ...interestPlans];
}

export const Route = createFileRoute("/$brand/producto/$slug")({
  validateSearch: z.object({ variant: z.string().optional() }),
  loader: async ({ params, context }) => {
    const brand = getBrand(params.brand);
    if (!brand) throw notFound();
    const [settings, product] = await Promise.all([
      context.queryClient.ensureQueryData(catalogQueries.settings()),
      context.queryClient.ensureQueryData(catalogQueries.detail(brand.slug, params.slug)),
    ]);
    applyAdminSettings(settings);
    refreshBrandData();
    if (!product) throw notFound();
    const refreshedBrand = getBrand(params.brand);
    if (!refreshedBrand) throw notFound();
    return {
      name: product.name,
      short: product.short,
      brandName: refreshedBrand.name,
      favicon: refreshedBrand.favicon,
      configuredCategories: refreshedBrand.categories,
      configuredPaymentMethods: (refreshedBrand.paymentMethods ?? [])
        .filter((method) => method.enabled)
        .map((method) => method.name),
      configuredFreeShippingThreshold: refreshedBrand.shipping?.freeShippingThreshold ?? 0,
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
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const brand = getBrand(params.brand)!;
  const slugVariantId = getProductVariantIdentityFromPublicSlug(params.slug);
  const { data: product } = useSuspenseQuery(catalogQueries.detail(brand.slug, params.slug));
  const { data: loadedProductImages = [] } = useQuery(
    catalogQueries.detailImages(brand.slug, params.slug),
  );
  const { data: related = [] } = useQuery(catalogQueries.related(brand.slug, params.slug));
  const relatedImageProductIds = Array.from(
    new Set(related.map((item) => item.parentId ?? item.id.split("::")[0]!)),
  );
  const { data: relatedImages = {} } = useQuery(catalogQueries.cardImages(relatedImageProductIds));
  const { addProduct } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    search.variant ??
      product?.variants?.find((variant) => variant.id === slugVariantId)?.id ??
      product?.variants?.[0]?.id,
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [installmentsDialogOpen, setInstallmentsDialogOpen] = useState(false);
  const navigate = useNavigate();

  const productImages = loadedProductImages;
  const selectedImage = productImages[selectedImageIndex] ?? productImages[0] ?? "";
  const hasMultipleImages = productImages.length > 1;

  useEffect(() => {
    if (!imageViewerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImageViewerOpen(false);
      if (!hasMultipleImages) return;
      if (event.key === "ArrowLeft") {
        setSelectedImageIndex((index) => (index - 1 + productImages.length) % productImages.length);
      }
      if (event.key === "ArrowRight") {
        setSelectedImageIndex((index) => (index + 1) % productImages.length);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasMultipleImages, imageViewerOpen, productImages.length]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setImageViewerOpen(false);
    const requestedVariant =
      product?.variants?.find((variant) => variant.id === search.variant) ??
      product?.variants?.find((variant) => variant.id === slugVariantId);
    setSelectedVariantId(requestedVariant?.id ?? product?.variants?.[0]?.id);
    setQuantity(1);
  }, [params.slug, product?.id, search.variant, slugVariantId]);

  const selectedVariant =
    product?.variants?.find((variant) => variant.id === selectedVariantId) ??
    product?.variants?.[0];
  const selectedVariantPrice = selectedVariant
    ? Math.max(0, selectedVariant.price * (1 - (selectedVariant.discount ?? 0) / 100))
    : (product?.price ?? 0);
  const cardPriceWithSurcharge = Math.round(selectedVariantPrice * 1.15 * 100) / 100;
  const installmentOptions = calculateInstallmentPlans(cardPriceWithSurcharge);

  if (!product) return null;

  const activeProduct = selectedVariant
    ? {
        ...product,
        id: `${product.id}::${selectedVariant.id}`,
        price: selectedVariantPrice,
        compareAtPrice: selectedVariant.discount ? selectedVariant.price : product.compareAtPrice,
        discount: selectedVariant.discount ?? 0,
        description: selectedVariant.description?.trim()
          ? selectedVariant.description
          : product.description,
        stock: selectedVariant.stock,
        variantName: selectedVariant.name,
        image: product.images?.[0],
        features: selectedVariant.features ?? product.features,
        includes: selectedVariant.includes ?? product.includes ?? [],
        ...(selectedVariant.priceCurrency ? { priceCurrency: selectedVariant.priceCurrency } : {}),
        ...(selectedVariant.comision !== undefined ? { comision: selectedVariant.comision } : {}),
        ...(selectedVariant.comisionCurrency
          ? { comisionCurrency: selectedVariant.comisionCurrency }
          : {}),
        ...(selectedVariant.cardCommission !== undefined
          ? { cardCommission: selectedVariant.cardCommission }
          : {}),
        ...(selectedVariant.stockUnlimited !== undefined
          ? { stockUnlimited: selectedVariant.stockUnlimited }
          : {}),
        ...(selectedVariant.gastos !== undefined ? { gastos: selectedVariant.gastos } : {}),
        ...(selectedVariant.gastosCurrency
          ? { gastosCurrency: selectedVariant.gastosCurrency }
          : {}),
      }
    : product;
  const hasStock = activeProduct.stockUnlimited || activeProduct.stock > 0;
  const normalizeTaxonomyValue = (value?: string) =>
    value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  const categoryValue = normalizeTaxonomyValue(product.category) ?? "";
  const subcategoryValue = normalizeTaxonomyValue(product.subcategory) ?? "";
  const findSubcategoryPath = (
    items: BrandSubcategory[] = [],
    target: string,
    path: BrandSubcategory[] = [],
  ): BrandSubcategory[] | null => {
    for (const item of items) {
      const nextPath = [...path, item];
      if (
        normalizeTaxonomyValue(item.slug) === target ||
        normalizeTaxonomyValue(item.name) === target
      ) {
        return nextPath;
      }
      const nestedPath = findSubcategoryPath(item.children, target, nextPath);
      if (nestedPath) return nestedPath;
    }
    return null;
  };
  const category = loaderData.configuredCategories.find(
    (item) =>
      normalizeTaxonomyValue(item.slug) === categoryValue ||
      normalizeTaxonomyValue(item.name) === categoryValue ||
      Boolean(findSubcategoryPath(item.subcategories, categoryValue)),
  );
  const subcategoryPath = category
    ? subcategoryValue
      ? (findSubcategoryPath(category.subcategories, subcategoryValue) ?? [])
      : []
    : [];
  const selectedSubcategory = subcategoryPath[0];
  const configuredPaymentMethods = loaderData.configuredPaymentMethods;
  const freeShippingThreshold = loaderData.configuredFreeShippingThreshold;

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

  const increaseQuantity = () => {
    if (activeProduct.stockUnlimited || quantity < activeProduct.stock) {
      setQuantity((value) => value + 1);
      return;
    }

    toast.error("No se puede agregar más unidades", {
      description: `${activeProduct.name} alcanzó su límite de stock (${activeProduct.stock}).`,
    });
  };

  return (
    <main className="mx-auto min-w-0 w-full max-w-7xl overflow-hidden px-4 pb-10 pt-20 sm:px-6">
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
              <Link to="/productos">Todos los productos</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/$brand" params={{ brand: brand.slug }}>
                {brand.shortName}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {category && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    to="/$brand/productos"
                    params={{ brand: brand.slug }}
                    search={{ categoria: category.slug ?? "" }}
                  >
                    {category.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
          {subcategoryPath.map((subcategory, index) => (
            <span key={subcategory.slug} className="contents">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    to="/$brand/productos"
                    params={{ brand: brand.slug }}
                    search={{
                      categoria: category?.slug ?? "",
                      subcategoria: subcategory.slug ?? "",
                    }}
                  >
                    {subcategory.name}
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </span>
          ))}
          <BreadcrumbItem>
            <BreadcrumbPage>{product.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="overflow-hidden rounded-3xl p-2">
          {productImages.length > 0 ? (
            <div>
              <button
                type="button"
                className="block aspect-4/3 w-full cursor-zoom-in overflow-hidden rounded-2xl bg-surface-2"
                onClick={() => setImageViewerOpen(true)}
                aria-label={`Abrir imagen ${selectedImageIndex + 1} de ${productImages.length}`}
              >
                <CroppedProductImage
                  image={selectedImage}
                  label={`${product.name} imagen ${selectedImageIndex + 1}`}
                />
              </button>
              {hasMultipleImages && (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {productImages.slice(1).map((image, thumbnailIndex) => {
                    const index = thumbnailIndex + 1;
                    return (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        className={`aspect-square overflow-hidden rounded-xl border-2 bg-surface-2 transition ${
                          selectedImageIndex === index
                            ? "border-primary"
                            : "border-transparent hover:border-border"
                        }`}
                        onClick={() => setSelectedImageIndex(index)}
                        aria-label={`Seleccionar imagen ${index + 1}`}
                        aria-pressed={selectedImageIndex === index}
                      >
                        <CroppedProductImage
                          image={image}
                          label={`${product.name} miniatura ${index + 1}`}
                        />
                      </button>
                    );
                  })}
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

        {imageViewerOpen && selectedImage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-label={`Visor de imágenes de ${product.name}`}
            onClick={() => setImageViewerOpen(false)}
          >
            <div
              className="relative flex max-h-full max-w-6xl items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="h-[90vh] w-[90vw] max-w-6xl">
                <CroppedProductImage
                  image={selectedImage}
                  label={`${product.name} imagen ${selectedImageIndex + 1}`}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -right-2 -top-2 rounded-full sm:-right-4 sm:-top-4"
                onClick={() => setImageViewerOpen(false)}
                aria-label="Cerrar imagen"
              >
                <X className="size-4" />
              </Button>
              {hasMultipleImages && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full sm:-left-16"
                    onClick={() =>
                      setSelectedImageIndex(
                        (index) => (index - 1 + productImages.length) % productImages.length,
                      )
                    }
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="size-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full sm:-right-16"
                    onClick={() =>
                      setSelectedImageIndex((index) => (index + 1) % productImages.length)
                    }
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight className="size-5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="min-w-0 pl-0 lg:pl-3">
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
          <h1 className="font-display mt-4 wrap-break-word text-3xl font-semibold sm:text-4xl">
            {product.name}
          </h1>
          {(deliveryText || freeShippingText) && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Truck className="size-4 text-primary" />
                {deliveryText}
                {freeShippingText}
              </span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {configuredPaymentMethods.map((payment, index) => (
              <span
                key={payment}
                className="inline-flex items-center gap-2 text-xs text-muted-foreground"
              >
                {index > 0 && <span aria-hidden="true">·</span>}
                {payment}
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm text-sky-400">
            Si abonás con tarjeta de crédito/débito o Mercado Pago, se suma un 15% al precio. Tenés
            hasta 6 cuotas sin interés.
          </p>

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

          <div className="mt-6 w-full max-w-md space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {activeProduct.compareAtPrice && (
                <span className="block text-sm text-muted-foreground line-through">
                  {formatPrice(activeProduct.compareAtPrice)}
                </span>
              )}
              <span className="font-display block text-3xl font-semibold leading-none">
                {formatPrice(activeProduct.price)}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm font-medium text-sky-400 transition hover:text-sky-300 hover:underline"
                onClick={() => setInstallmentsDialogOpen(true)}
              >
                <CreditCard className="size-4" />
                Tabla de cuotas
              </button>
            </div>

            <div className="flex items-center justify-start gap-3 pt-1">
              <div className="flex items-center gap-0.5 rounded-full border border-border bg-background/70 p-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  aria-label="Restar unidad"
                >
                  <Minus className="size-3.5" />
                </Button>
                <input
                  type="number"
                  min={1}
                  max={activeProduct.stockUnlimited ? undefined : activeProduct.stock}
                  value={quantity}
                  onChange={(event) => {
                    const nextQuantity = Number(event.target.value);
                    if (!Number.isFinite(nextQuantity)) return;
                    setQuantity(
                      activeProduct.stockUnlimited
                        ? Math.max(1, nextQuantity)
                        : Math.min(Math.max(1, nextQuantity), activeProduct.stock),
                    );
                  }}
                  className="quantity-input h-7 w-8 rounded-lg border-0 bg-transparent text-center text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                  aria-label={`Cantidad de ${activeProduct.name}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-full"
                  onClick={increaseQuantity}
                  aria-label="Sumar unidad"
                  disabled={!hasStock}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>

              <p className="text-sm font-medium text-muted-foreground">
                {activeProduct.stockUnlimited
                  ? "∞ Stock ilimitado"
                  : activeProduct.stock > 0
                    ? `${activeProduct.stock} en stock`
                    : "Sin stock"}
              </p>
            </div>

            <div className="flex flex-nowrap items-center justify-start gap-2 pt-1">
              <Button
                size="lg"
                className="min-w-0 flex-1 px-2! text-xs! sm:gap-2 sm:px-3! sm:text-sm!"
                disabled={!hasStock}
                onClick={() => addProduct(activeProduct, quantity)}
              >
                <ShoppingCart className="size-4" />
                {hasStock ? "Agregar al carrito" : "Sin stock"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="min-w-0 flex-1 px-2! text-xs! sm:gap-2 sm:px-3! sm:text-sm!"
                onClick={() => {
                  if (!hasStock) return;
                  addProduct(activeProduct, quantity);
                  navigate({ to: "/checkout" });
                }}
              >
                <ShoppingBag className="size-4" />
                Comprar ahora
              </Button>
            </div>
          </div>

          <Dialog open={installmentsDialogOpen} onOpenChange={setInstallmentsDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tabla de cuotas</DialogTitle>
                <DialogDescription>
                  Estimación para el precio de esta opción con el recargo del 15%: {""}
                  {formatPrice(cardPriceWithSurcharge)}.
                </DialogDescription>
              </DialogHeader>
              {installmentOptions.length === 0 ? (
                <p className="rounded-lg border border-border p-3 text-center text-sm text-muted-foreground">
                  No hay cuotas disponibles para este precio.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full table-fixed text-center text-sm tabular-nums">
                    <colgroup>
                      <col style={{ width: "33.333%" }} />
                      <col style={{ width: "33.333%" }} />
                      <col style={{ width: "33.334%" }} />
                    </colgroup>
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-2 text-center! font-medium">Cuotas</th>
                        <th className="px-2 py-2 text-center! font-medium">Valor por cuota</th>
                        <th className="px-2 py-2 text-center! font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installmentOptions.map((option) => (
                        <tr key={option.installments} className="border-t border-border">
                          <td className="px-2 py-2.5 text-center!">
                            {option.installments} {option.installments === 1 ? "cuota" : "cuotas"}
                            {option.interestFree ? (
                              <span className="mt-0.5 block text-xs text-green-500">
                                Sin interés
                              </span>
                            ) : null}
                          </td>
                          <td className="px-2 py-2.5 text-center! font-medium">
                            {formatInstallmentPrice(option.installmentAmount)}
                          </td>
                          <td className="px-2 py-2.5 text-center! text-muted-foreground">
                            {formatInstallmentPrice(option.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Cuotas estimadas localmente con los valores de referencia proporcionados; el monto
                puede variar según las condiciones vigentes de Mercado Pago.
              </p>
            </DialogContent>
          </Dialog>

          <Tabs defaultValue="description" className="mt-8">
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              <TabsTrigger value="features">Características</TabsTrigger>
              <TabsTrigger value="description">Descripción</TabsTrigger>
              <TabsTrigger value="includes">Incluye</TabsTrigger>
            </TabsList>
            <TabsContent value="features" className="pt-4">
              {activeProduct.features?.length ? (
                <ul className="grid gap-2.5 text-sm">
                  {activeProduct.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="size-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="leading-relaxed text-muted-foreground">
                  No hay características para mostrar.
                </p>
              )}
            </TabsContent>
            <TabsContent value="description" className="pt-4">
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                {activeProduct.description?.trim() || "No hay descripción para mostrar."}
              </p>
            </TabsContent>
            <TabsContent value="includes" className="pt-4">
              {activeProduct.includes?.length ? (
                <ul className="grid gap-2.5 text-sm">
                  {activeProduct.includes.map((include) => (
                    <li key={include} className="flex items-center gap-2">
                      <Check className="size-4 text-primary" />
                      {include}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="leading-relaxed text-muted-foreground">No incluye nada.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <SectionHeading eyebrow="También te puede gustar" title="Productos relacionados" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item, index) => {
              const parentId = item.parentId ?? item.id.split("::")[0]!;
              const image = relatedImages[parentId];
              const relatedProduct = image ? { ...item, image, images: [image] } : item;
              return <ProductCard key={item.id} product={relatedProduct} index={index} />;
            })}
          </div>
        </section>
      )}
    </main>
  );
}
