import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LoaderCircle,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { applyAdminSettings, getBrand, refreshBrandData } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import {
  getMercadoPagoCardIssuers,
  getMercadoPagoCardMethods,
  getMercadoPagoInstallments,
} from "@/server/mercadopago";
import { catalogQueries } from "@/services/catalog.service";
import { useCart } from "@/store/cart-context";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/$brand/producto/$slug")({
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
    await context.queryClient.ensureQueryData(catalogQueries.related(brand.slug, params.slug));
    return {
      name: product.name,
      short: product.short,
      brandName: brand.name,
      favicon: brand.favicon,
      configuredCategories: brand.categories,
      configuredPaymentMethods: (brand.paymentMethods ?? [])
        .filter((method) => method.enabled)
        .map((method) => method.name),
      configuredFreeShippingThreshold: brand.shipping?.freeShippingThreshold ?? 0,
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
  const loaderData = Route.useLoaderData();
  const brand = getBrand(params.brand)!;
  const { data: product } = useSuspenseQuery(catalogQueries.detail(brand.slug, params.slug));
  const { data: related } = useSuspenseQuery(catalogQueries.related(brand.slug, params.slug));
  const { addProduct } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(
    product?.variants?.[0]?.id,
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [installmentsDialogOpen, setInstallmentsDialogOpen] = useState(false);
  const [installmentCards, setInstallmentCards] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedInstallmentCard, setSelectedInstallmentCard] = useState("");
  const [installmentIssuers, setInstallmentIssuers] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [selectedInstallmentIssuer, setSelectedInstallmentIssuer] = useState("");
  const [installmentOptions, setInstallmentOptions] = useState<
    Array<{
      installments: number;
      installment_amount: number;
      total_amount: number;
      installment_rate: number;
    }>
  >([]);
  const [isLoadingInstallmentCards, setIsLoadingInstallmentCards] = useState(false);
  const [isLoadingInstallmentIssuers, setIsLoadingInstallmentIssuers] = useState(false);
  const [isLoadingInstallmentOptions, setIsLoadingInstallmentOptions] = useState(false);
  const [installmentError, setInstallmentError] = useState("");
  const navigate = useNavigate();

  const productImages = product?.images ?? [];
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
  }, [product?.id]);

  const selectedVariant =
    product?.variants?.find((variant) => variant.id === selectedVariantId) ??
    product?.variants?.[0];
  const cardPriceWithSurcharge =
    Math.round((selectedVariant?.price ?? product?.price ?? 0) * 1.15 * 100) / 100;

  useEffect(() => {
    if (!installmentsDialogOpen) return;

    let cancelled = false;
    setInstallmentError("");
    setIsLoadingInstallmentCards(true);
    void getMercadoPagoCardMethods({ data: {} })
      .then((methods) => {
        if (cancelled) return;
        setInstallmentCards(methods);
        const visa = methods.find(
          (method) => method.id.toLowerCase() === "visa" || method.name.toLowerCase() === "visa",
        );
        setSelectedInstallmentCard(visa?.id ?? "");
        if (!visa) {
          setInstallmentError("Mercado Pago no informó Visa como tarjeta disponible.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setInstallmentError(
          error instanceof Error ? error.message : "No se pudieron consultar las tarjetas.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInstallmentCards(false);
      });

    return () => {
      cancelled = true;
    };
  }, [installmentsDialogOpen]);

  useEffect(() => {
    if (
      !installmentsDialogOpen ||
      isLoadingInstallmentCards ||
      !installmentCards.length ||
      !selectedInstallmentCard
    )
      return;

    let cancelled = false;
    setSelectedInstallmentIssuer("");
    setInstallmentIssuers([]);
    setInstallmentOptions([]);
    setInstallmentError("");
    setIsLoadingInstallmentIssuers(true);
    void getMercadoPagoCardIssuers({ data: { paymentMethodId: selectedInstallmentCard } })
      .then((issuers) => {
        if (cancelled) return;
        setInstallmentIssuers(issuers);
        const galicia = issuers.find((issuer) =>
          issuer.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes("galicia"),
        );
        setSelectedInstallmentIssuer(galicia?.id ?? "");
        if (!galicia) {
          setInstallmentError("Mercado Pago no informó Banco Galicia como emisor de esta tarjeta.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setInstallmentError(
          error instanceof Error ? error.message : "No se pudieron consultar los bancos emisores.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInstallmentIssuers(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    installmentsDialogOpen,
    installmentCards.length,
    isLoadingInstallmentCards,
    selectedInstallmentCard,
  ]);

  useEffect(() => {
    if (!installmentsDialogOpen || !selectedInstallmentCard || !selectedInstallmentIssuer) return;

    let cancelled = false;
    setInstallmentError("");
    setIsLoadingInstallmentOptions(true);
    void getMercadoPagoInstallments({
      data: {
        amount: cardPriceWithSurcharge,
        paymentMethodId: selectedInstallmentCard,
        issuerId: selectedInstallmentIssuer,
      },
    })
      .then((options) => {
        if (!cancelled) setInstallmentOptions(options);
      })
      .catch((error) => {
        if (cancelled) return;
        setInstallmentOptions([]);
        setInstallmentError(
          error instanceof Error ? error.message : "No se pudieron consultar las cuotas.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingInstallmentOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    cardPriceWithSurcharge,
    installmentsDialogOpen,
    selectedInstallmentCard,
    selectedInstallmentIssuer,
  ]);

  if (!product) return null;

  const activeProduct = selectedVariant
    ? {
        ...product,
        id: `${product.id}::${selectedVariant.id}`,
        price: selectedVariant.price,
        description: selectedVariant.description,
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
              {product.compareAtPrice && (
                <span className="block text-sm text-muted-foreground line-through">
                  {formatPrice(product.compareAtPrice)}
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
                  Cuotas informadas por Mercado Pago para el precio con el recargo del 15%:{" "}
                  {formatPrice(cardPriceWithSurcharge)}.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Tarjeta</span>
                  <Select
                    value={selectedInstallmentCard}
                    onValueChange={setSelectedInstallmentCard}
                    disabled={isLoadingInstallmentCards || installmentCards.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná una tarjeta" />
                    </SelectTrigger>
                    <SelectContent>
                      {installmentCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Banco emisor</span>
                  <Select
                    value={selectedInstallmentIssuer}
                    onValueChange={setSelectedInstallmentIssuer}
                    disabled={isLoadingInstallmentIssuers || installmentIssuers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {installmentIssuers.map((issuer) => (
                        <SelectItem key={issuer.id} value={issuer.id}>
                          {issuer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {isLoadingInstallmentCards ||
              isLoadingInstallmentIssuers ||
              isLoadingInstallmentOptions ? (
                <div className="flex items-center justify-center gap-2 py-5 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Consultando planes y cuotas…
                </div>
              ) : installmentError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {installmentError}
                </p>
              ) : installmentOptions.length === 0 ? (
                <p className="rounded-lg border border-border p-3 text-center text-sm text-muted-foreground">
                  Mercado Pago no informó cuotas disponibles para esta tarjeta, banco y monto.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full table-fixed text-center text-sm">
                    <colgroup>
                      <col className="w-1/3" />
                      <col className="w-1/3" />
                      <col className="w-1/3" />
                    </colgroup>
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-center font-medium">Cuotas</th>
                        <th className="px-3 py-2 text-center font-medium">Valor por cuota</th>
                        <th className="px-3 py-2 text-center font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {installmentOptions.map((option) => (
                        <tr key={option.installments} className="border-t border-border">
                          <td className="px-3 py-2.5 text-center">
                            {option.installments} {option.installments === 1 ? "cuota" : "cuotas"}
                            {option.installment_rate === 0 ? (
                              <span className="mt-0.5 block text-xs text-green-500">
                                Sin interés
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-center font-medium">
                            {formatPrice(option.installment_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground">
                            {formatPrice(option.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Los planes y valores dependen de la tarjeta, el banco emisor y las condiciones
                vigentes de Mercado Pago.
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
              <p className="leading-relaxed text-muted-foreground">
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
            {related.map((item, index) => (
              <ProductCard key={item.id} product={item} index={index} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
