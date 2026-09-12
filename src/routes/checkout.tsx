import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { useCart } from "@/store/cart-context";
import { BrandHeader } from "@/components/layout/brand-header";
import { BrandFooter } from "@/components/layout/brand-footer";
import {
  applyAdminSettings,
  getBrand,
  refreshBrandData,
  type BrandPaymentMethod,
  type BrandSlug,
} from "@/config/brands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { orderQueries, orderService } from "@/services/catalog.service";
import { loadAdminSettings } from "@/server/persistence";
import {
  createMercadoPagoPreference,
  getMercadoPagoIntentStatus,
  type PaymentIntentData,
} from "@/server/mercadopago";
import { formatPrice } from "@/lib/format";
import { getUserProfile, getUserAddresses, updateUserProfile } from "@/lib/user";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout" },
      { name: "description", content: "Completá tus datos y finalizá la compra." },
      { property: "og:title", content: "Checkout" },
      { property: "og:description", content: "Checkout seguro de LRG Store Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "icon", href: "/LRG Store Shop PNG.png", type: "image/png" }],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: kindeLoading } = useKindeAuth();
  const [step, setStep] = useState("form");
  const [orderId, setOrderId] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);

  // Choose brand from first item in cart if available, otherwise default to web-design
  const firstBrandSlug = items[0]?.brand ?? "web-design";
  const brand = getBrand(firstBrandSlug)!;
  const interestFreeOptions = [1];

  // Ensure header and footer are shown on checkout
  const Header = <BrandHeader brand={brand} headerTheme="theme-webdesign" />;

  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const brandSlugs = useMemo(
    () => Array.from(new Set(items.map((item) => item.brand))),
    [items],
  );
  const [shippingMethodsByBrand, setShippingMethodsByBrand] = useState<Record<string, string>>({});
  const [paymentMethodsByBrand, setPaymentMethodsByBrand] = useState<Record<string, string>>({});
  const [bankCbu, setBankCbu] = useState("");
  const [brandSettingsReady, setBrandSettingsReady] = useState(false);
  const [creditCardOpen, setCreditCardOpen] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const getShippingMethods = (slug: BrandSlug) =>
    (getBrand(slug)?.shipping?.methods ?? []).filter((method) => method.enabled);
  const getPaymentMethods = (slug: BrandSlug) =>
    (getBrand(slug)?.paymentMethods ?? []).filter((method) => method.enabled);
  const isCardMethod = (value: string) =>
    /visa|mastercard|amex|tarjeta|d[eé]bito|cr[eé]dito/i.test(value);
  const isCardPayment = Object.values(paymentMethodsByBrand).some(isCardMethod);
  const isMercadoPagoPayment = isCardPayment;

  useEffect(() => {
    setShippingMethodsByBrand((current) =>
      Object.fromEntries(
        brandSlugs.map((slug) => [slug, current[slug] ?? ""]),
      ),
    );
    setPaymentMethodsByBrand((current) =>
      Object.fromEntries(
        brandSlugs.map((slug) => [slug, current[slug] ?? ""]),
      ),
    );
  }, [brandSlugs]);

  useEffect(() => {
    void loadAdminSettings({ data: {} }).then((settings) => {
      applyAdminSettings(settings);
      const refreshedBrands = refreshBrandData();
      const paymentSetting = settings.find(
        (setting) => setting.settingKey === "lrg:paymentMethods",
      );
      const shippingSetting = settings.find(
        (setting) => setting.settingKey === "lrg:shippingMethods",
      );
      let paymentMethodsFromDatabase: Record<string, BrandPaymentMethod[]> = {};
      let shippingMethodsFromDatabase: Record<string, BrandPaymentMethod[]> = {};
      try {
        const storedPayments = paymentSetting
          ? (JSON.parse(paymentSetting.settingValue) as
              | BrandPaymentMethod[]
              | Record<string, BrandPaymentMethod[]>)
          : undefined;
        const storedShipping = shippingSetting
          ? (JSON.parse(shippingSetting.settingValue) as
              | BrandPaymentMethod[]
              | Record<string, { methods?: BrandPaymentMethod[] }>)
          : undefined;
        paymentMethodsFromDatabase = Array.isArray(storedPayments)
          ? Object.fromEntries(brandSlugs.map((slug) => [slug, storedPayments]))
          : storedPayments ?? {};
        shippingMethodsFromDatabase = Array.isArray(storedShipping)
          ? Object.fromEntries(brandSlugs.map((slug) => [slug, storedShipping]))
          : Object.fromEntries(
              Object.entries(storedShipping ?? {}).map(([slug, config]) => [
                slug,
                Array.isArray(config)
                  ? config
                  : (config as { methods?: BrandPaymentMethod[] }).methods ?? [],
              ]),
            );
      } catch {
        // Use the refreshed brand configuration when a legacy value is invalid.
      }
      setShippingMethodsByBrand((current) =>
        Object.fromEntries(
          brandSlugs.map((slug) => {
            const methods =
              shippingMethodsFromDatabase[slug]?.filter((method) => method.enabled) ??
              refreshedBrands[slug]?.shipping?.methods.filter((method) => method.enabled) ??
              [];
            return [slug, current[slug] || (methods.length === 1 ? methods[0]?.name ?? "" : "")];
          }),
        ),
      );
      setPaymentMethodsByBrand((current) =>
        Object.fromEntries(
          brandSlugs.map((slug) => {
            const methods =
              paymentMethodsFromDatabase[slug]?.filter((method) => method.enabled) ??
              refreshedBrands[slug]?.paymentMethods?.filter((method) => method.enabled) ??
              [];
            return [slug, current[slug] || (methods.length === 1 ? methods[0]?.name ?? "" : "")];
          }),
        ),
      );
      setBrandSettingsReady(true);
      const storedCbu = settings.find((item) => item.settingKey === "lrg:bank-cbu")?.settingValue;
      if (!storedCbu) return;
      try {
        const cbuByBrand = JSON.parse(storedCbu) as Record<string, string>;
        setBankCbu(cbuByBrand[brand.slug] ?? "");
      } catch {
        setBankCbu(storedCbu);
      }
    });
  }, [brand.slug, brandSlugs]);
  const [couponCode] = useState(() => {
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
  const [couponBrandSlug] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    try {
      return JSON.parse(window.localStorage.getItem("lrg_checkout_coupon") ?? "{}").brandSlug;
    } catch {
      return undefined;
    }
  });
  const [validationMessage, setValidationMessage] = useState("");
  const validationRef = useRef<HTMLDivElement | null>(null);
  const checkoutFormRef = useRef<HTMLFormElement | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<
    Array<{
      id?: string;
      label: string;
      value: string;
      city?: string;
      street?: string;
      streetNumber?: string;
      floor?: string;
      apartment?: string;
      province?: string;
      postalCode?: string;
      isPrimary?: boolean;
    }>
  >([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState("");
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const geocodedAddressRef = useRef("");
  const discountedItemsSubtotal = couponApplied
    ? items
        .filter((item) => item.brand === couponBrandSlug)
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
    : 0;
  const discountedSubtotal = subtotal - (discountedItemsSubtotal * couponPercentage) / 100;
  const eligibleCardSubtotal = items.reduce(
    (total, item) =>
      total +
      (item.cardCommission && isCardMethod(paymentMethodsByBrand[item.brand] ?? "")
        ? item.price * item.quantity *
          (couponApplied && item.brand === couponBrandSlug
            ? 1 - couponPercentage / 100
            : 1)
        : 0),
    0,
  );
  const cardFee = isCardPayment
    ? eligibleCardSubtotal * (couponApplied ? 1 - couponPercentage / 100 : 1) * 0.1
    : 0;
  const total = discountedSubtotal + cardFee;
  const combinedPaymentMethod = Object.entries(paymentMethodsByBrand)
    .map(([slug, method]) => `${getBrand(slug as BrandSlug)?.name}: ${method}`)
    .join(" | ");
  const combinedShippingMethod = Object.entries(shippingMethodsByBrand)
    .map(([slug, method]) => `${getBrand(slug as BrandSlug)?.name}: ${method}`)
    .join(" | ");

    useEffect(() => {
      if (step !== "done") return;
      window.sessionStorage.setItem("lrg_checkout_completed", "true");
      const redirectTimer = window.setTimeout(() => {
        navigate({ to: "/productos", replace: true });
      }, 8000);
      return () => window.clearTimeout(redirectTimer);
    }, [step]);

    useEffect(() => {
      if (step !== "form" || typeof window === "undefined") return;
      const completedCheckout = window.sessionStorage.getItem("lrg_checkout_completed") === "true";
      if (completedCheckout && items.length === 0) {
        navigate({ to: "/productos", replace: true });
        return;
      }
      if (items.length > 0) {
        window.sessionStorage.removeItem("lrg_checkout_completed");
      }
    }, [items.length, step]);

  useEffect(() => {
    if (validationMessage && validationRef.current) {
      validationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      validationRef.current.focus();
    }
  }, [validationMessage]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intentId = params.get("intent");
    if (params.get("payment") !== "success" || !intentId) return;

    let attempts = 0;
    const checkPayment = () => {
      void getMercadoPagoIntentStatus({ data: { intentId } }).then((status) => {
        if (typeof status === "object" && status.status === "approved" && status.orderId) {
          setOrderId(status.orderId);
          setPaymentApproved(true);
          return;
        }
        attempts += 1;
        if (attempts < 10) window.setTimeout(checkPayment, 1500);
      });
    };
    checkPayment();
  }, []);

  // Cargar datos del usuario si está logueado
  useEffect(() => {
    if (!isAuthenticated || !user?.id || kindeLoading) return;

    void getUserProfile({ data: { userId: user.id } }).then((profile) => {
      if (profile) {
        setCustomerName(user.givenName || "");
        setEmail(user.email || "");
        setPhone(profile.phone || "");
        setDocument(profile.document || "");
        setCity(profile.city || "");
        // address no se carga automáticamente, solo si selecciona una dirección guardada
      }
    });

    setAddressesLoading(true);
    void getUserAddresses({ data: { userId: user.id } })
      .then((addresses) => {
        setSavedAddresses(addresses);
        const primaryAddress = addresses.find((savedAddress) => savedAddress.isPrimary);
        if (primaryAddress) {
          setSelectedSavedAddress(primaryAddress.id ?? "");
          setAddress(primaryAddress.value);
          setStreet(primaryAddress.street ?? "");
          setStreetNumber(primaryAddress.streetNumber ?? "");
          setFloor(primaryAddress.floor ?? "");
          setApartment(primaryAddress.apartment ?? "");
          setCity(primaryAddress.city ?? "");
          setProvince(primaryAddress.province ?? "");
          setPostalCode(primaryAddress.postalCode ?? "");
        }
      })
      .finally(() => setAddressesLoading(false));
  }, [isAuthenticated, user?.email, user?.givenName, user?.id, kindeLoading]);

  useEffect(() => {
    const query = address.trim();
    if (!query) {
      setMapPreviewUrl(null);
      return;
    }
    if (geocodedAddressRef.current === query) return;

    const timer = window.setTimeout(async () => {
      try {
        setIsMapLoading(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`,
          { headers: { "Accept-Language": "es" } },
        );
        const results = (await response.json()) as Array<{
          lat?: string;
          lon?: string;
          display_name?: string;
          address?: Record<string, string>;
        }>;
        const firstResult = results[0];
        const resultAddress = firstResult?.address;
        const inputNumbers = query.match(/\b\d{1,6}\b/g) ?? [];
        const inputNumber = inputNumbers.at(-1) ?? "";
        const displayNameFirstPart = firstResult?.display_name?.split(",")[0]?.trim() ?? "";
        const displayNameNumbers = displayNameFirstPart.match(/\b\d{1,6}\b/g) ?? [];
        const resultNumber =
          resultAddress?.["house_number"] ||
          displayNameNumbers.at(-1) ||
          "";
        const resolvedStreet =
          resultAddress?.["road"] ||
          resultAddress?.["pedestrian"] ||
          resultAddress?.["street"] ||
          street;
        const resolvedNumber = inputNumber || resultNumber || streetNumber;
        const resolvedCity =
          resultAddress?.["city"] ||
          resultAddress?.["town"] ||
          resultAddress?.["village"] ||
          resultAddress?.["municipality"] ||
          city;
        const resolvedProvince =
          resultAddress?.["state"] || resultAddress?.["province"] || province;
        const resolvedPostalCode = resultAddress?.["postcode"] || postalCode;
        geocodedAddressRef.current = query;
        setStreet(resolvedStreet);
        setStreetNumber(resolvedNumber);
        setCity(resolvedCity);
        setProvince(resolvedProvince);
        setPostalCode(resolvedPostalCode);
        if (firstResult?.lat && firstResult.lon) {
          setMapPreviewUrl(
            `https://maps.google.com/maps?q=${firstResult.lat},${firstResult.lon}&z=15&output=embed&hl=es`,
          );
        } else {
          setMapPreviewUrl(null);
        }
      } catch {
        setMapPreviewUrl(null);
      } finally {
        setIsMapLoading(false);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [address]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isConfirming) return;

    const missingFields: string[] = [];
    if (!customerName.trim()) missingFields.push("Nombre completo");
    if (!email.trim()) missingFields.push("Email");
    if (!phone.trim()) missingFields.push("Teléfono");
    if (!address.trim()) missingFields.push("Dirección");
    brandSlugs.forEach((slug) => {
      if (!shippingMethodsByBrand[slug]) missingFields.push(`Método de envío de ${getBrand(slug)?.name}`);
      if (!paymentMethodsByBrand[slug]) missingFields.push(`Método de pago de ${getBrand(slug)?.name}`);
    });
    if (missingFields.length > 0) {
      setValidationMessage(`Faltan completar: ${missingFields.join(", ")}.`);
      return;
    }

    setValidationMessage("");
    if (items.length === 0) return;
    if (paymentApproved) {
      clear();
      setStep("done");
      return;
    }
    setIsConfirming(true);
    if (isAuthenticated && user?.id) {
      void updateUserProfile({
        data: {
          userId: user.id,
          email: user.email || email,
          givenName: user.givenName || customerName,
          familyName: user.familyName || "",
          phone,
          document: document.trim(),
          city,
        },
      });
    }
    const id = `LRG-${Math.floor(10000 + Math.random() * 89999)}`;
    const expenses = Math.round(total * 0.65);
    const order = {
      id,
      brand: brand.slug,
      customer: customerName,
      email,
      phone,
      ...(document.trim() ? { document: document.trim() } : {}),
      isGuest: !isAuthenticated,
      ...(!isAuthenticated ? { guestCustomerId: id } : {}),
      city,
      street,
      streetNumber,
      floor,
      apartment,
      province,
      postalCode,
      extraInfo: notes,
      date: new Date().toISOString().slice(0, 10),
      total,
      expenses,
      profit: total - expenses,
      status: "pendiente" as const,
      deliveryStatus: "Pendiente" as const,
      paymentStatus: "Pendiente" as const,
      paymentMethod: Object.entries(paymentMethodsByBrand)
        .map(([slug, method]) => `${getBrand(slug as BrandSlug)?.name}: ${method}`)
        .join(" | "),
      installments: isCardPayment ? selectedInstallments : 1,
      discountCode: couponApplied ? couponCode.trim().toUpperCase() : undefined,
      cardFee,
      shippingMethod: Object.entries(shippingMethodsByBrand)
        .map(([slug, method]) => `${getBrand(slug as BrandSlug)?.name}: ${method}`)
        .join(" | "),
      items: items.map((item) => ({
        productId: item.id.includes("::") ? (item.id.split("::")[0] ?? item.id) : item.id,
        ...(item.id.includes("::") ? { variantId: item.id.split("::")[1] } : {}),
        ...(item.variantName ? { variantName: item.variantName } : {}),
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        brand: item.brand,
        ...(paymentMethodsByBrand[item.brand]
          ? { paymentMethod: paymentMethodsByBrand[item.brand] }
          : {}),
        ...(shippingMethodsByBrand[item.brand]
          ? { shippingMethod: shippingMethodsByBrand[item.brand] }
          : {}),
      })),
    };

    if (isMercadoPagoPayment) {
      try {
        const intentId = crypto.randomUUID();
        const payment: PaymentIntentData = {
          brand: brand.slug,
          customer: customerName,
          email,
          phone,
          city,
          address,
          notes,
          total,
          expenses,
          profit: total - expenses,
          paymentMethod: combinedPaymentMethod,
          installments: isCardPayment ? selectedInstallments : 1,
          discountCode: couponApplied ? couponCode.trim().toUpperCase() : undefined,
          cardFee,
          shippingMethod: combinedShippingMethod,
          isGuest: !isAuthenticated,
          ...(!isAuthenticated ? { guestCustomerId: id } : {}),
          items: order.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            ...(item.brand ? { brand: item.brand } : {}),
            ...(item.paymentMethod ? { paymentMethod: item.paymentMethod } : {}),
            ...(item.shippingMethod ? { shippingMethod: item.shippingMethod } : {}),
          })),
        };
        const preference = await createMercadoPagoPreference({
          data: { intentId, payment, returnUrl: window.location.href },
        });
        window.location.assign(preference.url);
      } catch (error) {
        setIsConfirming(false);
        setValidationMessage(
          error instanceof Error ? error.message : "No se pudo iniciar el pago con Mercado Pago.",
        );
      }
      return;
    }

    await orderService.create(order);
    const orderQueryKey = ["orders"] as const;
    queryClient.invalidateQueries({ queryKey: orderQueryKey });
    setOrderId(id);
    clear();
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
        {Header}
        <main className="flex min-h-screen items-start justify-center px-4 pb-16 pt-24 sm:px-6">
          <div className="glass-panel w-full max-w-2xl rounded-3xl p-8 text-center shadow-2xl sm:p-12">
            <CheckCircle2 className="mx-auto size-12 text-primary" />
            <h1 className="font-display mt-6 text-3xl font-semibold">¡Gracias por tu compra!</h1>
            <p className="mt-3 text-muted-foreground">
              Tu pedido <span className="text-foreground">{orderId}</span> fue confirmado.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              En unos segundos vas a ser redirigido al catálogo completo de la tienda.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/">
                  <ShoppingBag className="size-4" /> Seguir comprando
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/cuenta/panel">
                  <Package className="size-4" /> Ver mis compras
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
      {Header}
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-24 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Checkout</p>
            <h1 className="mt-2 text-3xl font-semibold">Finalizar compra</h1>
          </div>
          <Link to="/carrito">
            <Button className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-50">
              <ArrowLeft className="size-4 text-current" /> Volver
            </Button>
          </Link>
        </div>

        <form
          ref={checkoutFormRef}
          onSubmit={submit}
          noValidate
          aria-busy={!brandSettingsReady}
          className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]"
        >
          {validationMessage && (
            <div
              ref={validationRef}
              tabIndex={-1}
              className="lg:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 outline-none"
              role="alert"
              aria-live="polite"
            >
              ⚠️ {validationMessage}
            </div>
          )}
          <div className="space-y-6">
            <section className="glass-panel rounded-2xl p-6">
              <h2 className="font-display flex items-center gap-2 font-semibold">
                <Truck className="size-4 text-primary" /> Datos de envío
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input
                    id="name"
                    required
                    placeholder="Juan Pérez"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="juan@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Celular / Teléfono</Label>
                  <Input
                    id="phone"
                    required
                    placeholder="+54 11 5555 5555"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">DNI / CUIT (opcional)</Label>
                  <Input
                    id="document"
                    placeholder="DNI / CUIT"
                    value={document}
                    onChange={(e) => setDocument(e.target.value)}
                  />
                </div>
                {isAuthenticated && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Dirección a enviar producto</Label>
                    {addressesLoading ? (
                      <div className="flex items-center gap-2 rounded-lg border border-input p-3 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Cargando dirección...
                      </div>
                    ) : savedAddresses.length > 0 ? (
                      <div className="space-y-2">
                        {savedAddresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                              selectedSavedAddress === addr.id
                                ? "border-primary bg-primary/10"
                                : "border-input hover:border-primary/50"
                            }`}
                            onClick={() => {
                              setSelectedSavedAddress(addr.id || "");
                              setAddress(addr.value);
                              setStreet(addr.street ?? "");
                              setStreetNumber(addr.streetNumber ?? "");
                              setFloor(addr.floor ?? "");
                              setApartment(addr.apartment ?? "");
                              setCity(addr.city ?? "");
                              setProvince(addr.province ?? "");
                              setPostalCode(addr.postalCode ?? "");
                            }}
                          >
                            <div className="font-medium">{addr.label}</div>
                            <div className="text-sm text-muted-foreground">{addr.value}</div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Dirección o referencia</Label>
                  <Input
                    id="address"
                    required
                    placeholder="Calle, referencia, barrio, etc."
                    value={address}
                    onChange={(event) => {
                      setSelectedSavedAddress("");
                      geocodedAddressRef.current = "";
                      setAddress(event.target.value);
                    }}
                  />
                  {isMapLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" /> Buscando ubicación...
                    </div>
                  )}
                  {mapPreviewUrl && (
                    <iframe
                      title="Mapa de la dirección"
                      src={mapPreviewUrl}
                      className="h-56 w-full rounded-xl border border-border/60"
                      loading="lazy"
                    />
                  )}
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    {([
                      ["Calle", street, setStreet, true],
                      ["Altura", streetNumber, setStreetNumber, true],
                      ["Piso", floor, setFloor, false],
                      ["Departamento", apartment, setApartment, false],
                      ["Ciudad", city, setCity, true],
                      ["Provincia", province, setProvince, true],
                      ["Código Postal", postalCode, setPostalCode, true],
                    ] as Array<[string, string, (next: string) => void, boolean]>).map(
                      ([label, value, setter, synced]) => (
                      <label key={String(label)} className="space-y-1 text-sm">
                        <span>{label}</span>
                        <Input
                          value={String(value)}
                          onChange={(event) => {
                            (setter as (next: string) => void)(event.target.value);
                            if (synced) setSelectedSavedAddress("");
                          }}
                          readOnly={Boolean(synced)}
                          className={synced ? "bg-muted/40" : "bg-background"}
                        />
                      </label>
                      ),
                    )}
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notas del pedido (opcional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Indicaciones para la entrega"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-6">
              <h2 className="font-display flex items-center gap-2 font-semibold">
                <Truck className="size-4 text-primary" /> Método de envío
              </h2>
              <div className="mt-4 space-y-3">
                {brandSlugs.map((slug) => (
                  <div key={slug} className="space-y-2">
                    <Label>{getBrand(slug)?.name}</Label>
                    <RadioGroup
                      value={shippingMethodsByBrand[slug] ?? ""}
                      onValueChange={(value) =>
                        setShippingMethodsByBrand((current) => ({ ...current, [slug]: value }))
                      }
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {getShippingMethods(slug).map((method) => (
                        <label
                          key={method.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2/60 px-4 py-3 text-sm"
                        >
                          <RadioGroupItem value={method.name} />
                          {method.name}
                        </label>
                      ))}
                      {getShippingMethods(slug).length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No hay métodos de envío disponibles para esta tienda.
                        </p>
                      )}
                    </RadioGroup>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-2xl p-6">
              <h2 className="font-display flex items-center gap-2 font-semibold">
                <CreditCard className="size-4 text-primary" /> Método de pago
              </h2>
              <div className="mt-5 space-y-4">
                {brandSlugs.map((slug) => (
                  <div key={slug} className="space-y-2">
                    <Label>{getBrand(slug)?.name}</Label>
                    <RadioGroup
                      value={paymentMethodsByBrand[slug] ?? ""}
                      onValueChange={(value) => {
                        setPaymentMethodsByBrand((current) => ({ ...current, [slug]: value }));
                        if (isCardMethod(value)) {
                          window.setTimeout(() => checkoutFormRef.current?.requestSubmit(), 0);
                        }
                      }}
                      className="grid gap-2 sm:grid-cols-2"
                    >
                      {getPaymentMethods(slug).map((method) => (
                        <label
                          key={method.id}
                          className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-2/60 px-4 py-3 text-sm"
                        >
                          <RadioGroupItem value={method.name} />
                          {method.name}
                        </label>
                      ))}
                      {getPaymentMethods(slug).length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          No hay métodos de pago disponibles para esta tienda.
                        </p>
                      )}
                    </RadioGroup>
                    {/transferencia/i.test(paymentMethodsByBrand[slug] ?? "") && bankCbu && slug === firstBrandSlug && (
                      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                        <p className="font-semibold">Datos para transferencia bancaria</p>
                        <p className="mt-1 text-muted-foreground">CBU: {bankCbu}</p>
                        <p className="mt-2 text-muted-foreground">
                          Enviar comprobante por WhatsApp o Correo electrónico
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                {isCardPayment && (
                  <div className="flex items-center gap-3 text-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCreditCardOpen((current) => !current)}
                    >
                      {creditCardOpen ? "Ocultar cuotas" : "Configurar cuotas"}
                    </Button>
                    {creditCardOpen && interestFreeOptions.map((installments) => (
                      <label key={installments} className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="installments"
                          checked={selectedInstallments === installments}
                          onChange={() => setSelectedInstallments(installments)}
                        />
                        {installments === 1 ? "1 pago" : `${installments} cuotas`}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {paymentApproved && (
                <div className="mt-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-600">
                  Pago abonado correctamente. Revisá tu pedido y presioná Comprar para confirmar.
                </div>
              )}
            </section>
          </div>

          <aside className="glass-panel h-fit rounded-2xl p-6 lg:sticky lg:top-24">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <h2 className="font-display flex items-center gap-2 font-semibold">
                <ShoppingBag className="size-4 text-primary" /> Tu pedido
              </h2>
              <span className="text-xs text-muted-foreground">
                {items.length} {items.length === 1 ? "producto" : "productos"}
              </span>
            </div>
            <div className="mt-5 space-y-0 text-sm">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Productos
                </h3>
                <div className="mt-3 divide-y divide-border/70 border-b border-border/70">
                  {items.map((item) => (
                    <div key={item.id} className="space-y-1.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 font-medium text-foreground">{item.name}</p>
                        <span className="shrink-0 font-semibold text-foreground">
                          {formatPrice(item.price * item.quantity)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>Cantidad: {item.quantity}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getBrand(item.brand)?.name ?? item.brand}</span>
                        {item.variantName && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.variantName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-b border-border/70 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Envío
                </h3>
                <div className="mt-3 space-y-3">
                  {brandSlugs.map((slug) => (
                    <div key={slug} className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-foreground">{getBrand(slug)?.name}</span>
                      <span className="text-right text-muted-foreground">
                        {shippingMethodsByBrand[slug] || "Acordar entrega"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-b border-border/70 py-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Pago
                </h3>
                <div className="mt-3 space-y-3">
                  {brandSlugs.map((slug) => (
                    <div key={slug} className="flex items-center justify-between gap-4">
                      <span className="font-semibold text-foreground">{getBrand(slug)?.name}</span>
                      <span className="text-right text-muted-foreground">
                        {paymentMethodsByBrand[slug] || "A confirmar"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border-b border-border/70 py-4">
                <h3 className="font-display mb-4 font-semibold">Resumen</h3>
                <div className="flex items-center justify-between font-medium">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {couponApplied && (
                  <>
                    <div className="mt-3 flex items-center justify-between text-green-600">
                      <span>Código: {couponCode}</span>
                      <span>{couponPercentage}%</span>
                    </div>
                    <div className="flex items-center justify-between text-green-600">
                      <span>Descuento</span>
                      <span>-{formatPrice((discountedItemsSubtotal * couponPercentage) / 100)}</span>
                    </div>
                  </>
                )}
                {isCardPayment && cardFee > 0 && (
                  <div className="mt-3 flex items-center justify-between text-muted-foreground">
                    <span>Comisión tarjeta (10%)</span>
                    <span>{formatPrice(cardFee)}</span>
                  </div>
                )}
              </section>

              <div className="flex items-center justify-between py-4 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isConfirming || !brandSettingsReady}
              >
                {isConfirming ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> Confirmando compra...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="size-4" />
                    {paymentApproved ? "Confirmar compra" : "Comprar"}
                  </>
                )}
              </Button>
            </div>
          </aside>
        </form>
      </main>
      <BrandFooter brand={brand} />
    </div>
  );
}
