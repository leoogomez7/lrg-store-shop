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
import { toast } from "sonner";
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
import { cancelPaymentReservation, loadAdminSettings } from "@/server/persistence";
import {
  createMercadoPagoPreference,
  getMercadoPagoIntentStatus,
  type PaymentIntentData,
} from "@/server/mercadopago";
import { formatPrice } from "@/lib/format";
import { formatReservationCountdown } from "@/lib/stock-reservations";
import { extractStreetNumberFromResult, splitStreetAndNumber } from "@/lib/address";
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
  const {
    items,
    subtotal,
    clear,
    hydrated,
    reservationOwnerId,
    stockReservationStatuses,
    stockReservationNow,
    stockReservationsLoading,
    canProceedToCheckout,
  } = useCart();
  const paymentReturn =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("payment");
  const paymentIntentId =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("intent");
  const blockedReservation =
    hydrated && reservationOwnerId && paymentReturn !== "success"
      ? items.find((item) => {
          const state = stockReservationStatuses[item.id]?.state;
          return state !== "reserved" && state !== "unlimited";
        })
      : undefined;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: kindeLoading } = useKindeAuth();
  const [step, setStep] = useState("form");
  const [orderId, setOrderId] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [paymentApproved, setPaymentApproved] = useState(false);
  const activeReservationCountdowns = items.flatMap((item) => {
    const reservation = stockReservationStatuses[item.id];
    if (reservation?.state !== "reserved" || !reservation.expiresAt) return [];
    return [
      {
        name: item.name,
        countdown: formatReservationCountdown(reservation.expiresAt, stockReservationNow),
      },
    ];
  });

  useEffect(() => {
    if (paymentReturn !== "failure" || !paymentIntentId || !reservationOwnerId) return;
    let active = true;
    void cancelPaymentReservation({ data: { intentId: paymentIntentId } })
      .then(() => {
        if (!active) return;
        toast.info("Pago cancelado", {
          description: "Se liberó tu prioridad de compra. Revisá el carrito para reservar de nuevo.",
        });
        navigate({ to: "/carrito", replace: true });
      })
      .catch((error: unknown) => {
        console.error("No se pudo liberar la reserva del pago cancelado:", error);
        if (active) navigate({ to: "/carrito", replace: true });
      });
    return () => {
      active = false;
    };
  }, [navigate, paymentIntentId, paymentReturn, reservationOwnerId]);

  // Choose brand from first item in cart if available, otherwise default to web-design
  const firstBrandSlug = items[0]?.brand ?? "web-design";
  const brand = getBrand(firstBrandSlug)!;

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
  const [addressReferences, setAddressReferences] = useState("");
  const [notes, setNotes] = useState("");
  const brandSlugs = useMemo(() => Array.from(new Set(items.map((item) => item.brand))), [items]);
  const [shippingMethodsByBrand, setShippingMethodsByBrand] = useState<Record<string, string>>({});
  const [paymentMethodsByBrand, setPaymentMethodsByBrand] = useState<Record<string, string>>({});
  const [bankCbus, setBankCbus] = useState<Partial<Record<BrandSlug, string>>>({});
  const [brandSettingsReady, setBrandSettingsReady] = useState(false);
  const [selectedInstallments] = useState(1);
  const getShippingMethods = (slug: BrandSlug) =>
    (getBrand(slug)?.shipping?.methods ?? []).filter((method) => method.enabled);
  const getPaymentMethods = (slug: BrandSlug) =>
    (getBrand(slug)?.paymentMethods ?? []).filter((method) => method.enabled);
  const isCardMethod = (value: string) =>
    /tarjeta|d[eé]bito|cr[eé]dito|mercado\s*pago|\bmp\b/i.test(value.trim());
  const isCashOrTransferMethod = (value: string) => /transferencia|efectivo/i.test(value.trim());
  const mercadoPagoBrands = new Set(
    Object.entries(paymentMethodsByBrand)
      .filter(([, method]) => isCardMethod(method))
      .map(([slug]) => slug),
  );
  const isCardPayment = mercadoPagoBrands.size > 0;
  const isMercadoPagoPayment = isCardPayment;
  const hasCashOrTransferPayment =
    Object.values(paymentMethodsByBrand).some(isCashOrTransferMethod);
  useEffect(() => {
    setShippingMethodsByBrand((current) =>
      Object.fromEntries(brandSlugs.map((slug) => [slug, current[slug] ?? ""])),
    );
    setPaymentMethodsByBrand((current) =>
      Object.fromEntries(brandSlugs.map((slug) => [slug, current[slug] ?? ""])),
    );
  }, [brandSlugs]);

  useEffect(() => {
    void loadAdminSettings({ data: {} })
      .then((settings) => {
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
                BrandPaymentMethod[] | Record<string, BrandPaymentMethod[]>)
            : undefined;
          const storedShipping = shippingSetting
            ? (JSON.parse(shippingSetting.settingValue) as
                BrandPaymentMethod[] | Record<string, { methods?: BrandPaymentMethod[] }>)
            : undefined;
          paymentMethodsFromDatabase = Array.isArray(storedPayments)
            ? Object.fromEntries(brandSlugs.map((slug) => [slug, storedPayments]))
            : (storedPayments ?? {});
          shippingMethodsFromDatabase = Array.isArray(storedShipping)
            ? Object.fromEntries(brandSlugs.map((slug) => [slug, storedShipping]))
            : Object.fromEntries(
                Object.entries(storedShipping ?? {}).map(([slug, config]) => [
                  slug,
                  Array.isArray(config)
                    ? config
                    : ((config as { methods?: BrandPaymentMethod[] }).methods ?? []),
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
              return [
                slug,
                current[slug] || (methods.length === 1 ? (methods[0]?.name ?? "") : ""),
              ];
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
              return [
                slug,
                current[slug] || (methods.length === 1 ? (methods[0]?.name ?? "") : ""),
              ];
            }),
          ),
        );
        setBrandSettingsReady(true);
        const storedCbu = settings.find((item) => item.settingKey === "lrg:bank-cbu")?.settingValue;
        if (!storedCbu) return;
        try {
          const cbuByBrand = JSON.parse(storedCbu) as Record<string, string>;
          setBankCbus(cbuByBrand);
        } catch {
          setBankCbus({
            arcade: storedCbu,
            scents: storedCbu,
            "web-design": storedCbu,
          });
        }
      })
      .catch(() => {
        setBrandSettingsReady(true);
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
      return Boolean(
        JSON.parse(window.localStorage.getItem("lrg_checkout_coupon") ?? "{}").applied,
      );
    } catch {
      return false;
    }
  });
  const [couponPercentage, setCouponPercentage] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return (
        Number(JSON.parse(window.localStorage.getItem("lrg_checkout_coupon") ?? "{}").percentage) ||
        0
      );
    } catch {
      return 0;
    }
  });
  const [couponAmount, setCouponAmount] = useState(() => {
    if (typeof window === "undefined") return 0;
    try {
      return (
        Number(JSON.parse(window.localStorage.getItem("lrg_checkout_coupon") ?? "{}").amount) || 0
      );
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
  const discountedItemsSubtotal = couponApplied
    ? items
        .filter((item) => item.brand === couponBrandSlug)
        .reduce((sum, item) => sum + item.price * item.quantity, 0)
    : 0;
  const couponDiscountAmount = couponApplied
    ? discountedItemsSubtotal * (couponPercentage / 100) + couponAmount
    : 0;
  const discountedSubtotal = Math.max(0, subtotal - couponDiscountAmount);
  const eligibleCardSubtotal = items.reduce(
    (total, item) =>
      total +
      (isCardMethod(paymentMethodsByBrand[item.brand] ?? "")
        ? item.price *
          item.quantity *
          (couponApplied && item.brand === couponBrandSlug ? 1 - couponPercentage / 100 : 1)
        : 0),
    0,
  );
  const cardFee = eligibleCardSubtotal * 0.15;
  const mercadoPagoItems = items
    .filter((item) => mercadoPagoBrands.has(item.brand))
    .map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price:
        item.price *
        (couponApplied && item.brand === couponBrandSlug ? 1 - couponPercentage / 100 : 1) *
        1.15,
      brand: item.brand,
    }));
  const mercadoPagoSubtotal = mercadoPagoItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const mercadoPagoTotal = mercadoPagoSubtotal;
  const total = discountedSubtotal + cardFee;
  const combinedPaymentMethod = Object.entries(paymentMethodsByBrand)
    .map(([slug, method]) => `${getBrand(slug as BrandSlug)?.name}: ${method}`)
    .join(" | ");
  const combinedShippingMethod = Object.entries(shippingMethodsByBrand)
    .map(([slug, method]) => `${getBrand(slug as BrandSlug)?.name}: ${method}`)
    .join(" | ");

  useEffect(() => {
    if (step !== "done" || typeof window === "undefined") return;
    window.sessionStorage.setItem("lrg_checkout_completed", "true");
    window.history.pushState({ checkoutCompleted: true }, "", window.location.href);
    const handleCompletedCheckoutBack = () => {
      navigate({ to: "/", replace: true });
    };
    window.addEventListener("popstate", handleCompletedCheckoutBack);
    const redirectTimer = window.setTimeout(() => {
      navigate({ to: "/productos", replace: true });
    }, 8000);
    return () => {
      window.removeEventListener("popstate", handleCompletedCheckoutBack);
      window.clearTimeout(redirectTimer);
    };
  }, [navigate, step]);

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
  }, [items.length, navigate, step]);

  useEffect(() => {
    if (hydrated && items.length === 0 && paymentReturn !== "success" && step === "form") {
      navigate({ to: "/carrito", replace: true });
    }
  }, [hydrated, items.length, navigate, paymentReturn, step]);

  useEffect(() => {
    if (validationMessage && validationRef.current) {
      validationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      validationRef.current.focus();
    }
  }, [validationMessage]);

  useEffect(() => {
    if (paymentApproved) {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    }
  }, [paymentApproved, queryClient]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intentId = params.get("intent");
    if (params.get("payment") !== "success" || !intentId) return;

    let attempts = 0;
    let active = true;
    let timeout: number | undefined;
    const checkPayment = async () => {
      try {
        const status = await getMercadoPagoIntentStatus({ data: { intentId } });
        if (!active) return;

        if (typeof status === "object" && status.status === "approved" && status.orderId) {
          setOrderId(status.orderId);
          setPaymentApproved(true);
          clear();
          setStep("done");

          try {
            const orders = await orderService.list();
            const matchedOrder = orders.find((order) => order.id === status.orderId);
            if (matchedOrder) {
              await orderService.update({
                ...matchedOrder,
                status: "pagado",
                paymentStatus: "Pagado",
              });
              queryClient.invalidateQueries({ queryKey: ["orders"] });
            }
          } catch {
            // Ignoramos errores de actualización para no romper la confirmación del pago.
          }
          return;
        }

        attempts += 1;
        if (attempts < 10) timeout = window.setTimeout(checkPayment, 1500);
      } catch (error) {
        console.error("No se pudo consultar el estado del pago:", error);
        attempts += 1;
        if (attempts < 10) timeout = window.setTimeout(checkPayment, 1500);
      }
    };
    void checkPayment();
    return () => {
      active = false;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [clear, queryClient]);

  // Cargar datos del usuario si está logueado
  useEffect(() => {
    if (!isAuthenticated || !user?.id || kindeLoading) return;

    void getUserProfile({ data: { userId: user.id } }).then((profile) => {
      if (profile) {
        const givenName = profile.givenName || user.givenName || "";
        const familyName = profile.familyName || user.familyName || "";
        setCustomerName(
          [givenName, familyName].filter(Boolean).join(" ") || profile.fullName || "",
        );
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
          const parsedAddress = splitStreetAndNumber(primaryAddress.value);
          setSelectedSavedAddress(primaryAddress.id ?? "");
          setAddress(primaryAddress.value);
          setStreet(primaryAddress.street || parsedAddress.street || "");
          setStreetNumber(primaryAddress.streetNumber || parsedAddress.streetNumber || "");
          setFloor(primaryAddress.floor ?? "");
          setApartment(primaryAddress.apartment ?? "");
          setCity(primaryAddress.city ?? "");
          setProvince(primaryAddress.province ?? "");
          setPostalCode(primaryAddress.postalCode ?? "");
        }
      })
      .finally(() => setAddressesLoading(false));
  }, [isAuthenticated, user?.email, user?.familyName, user?.givenName, user?.id, kindeLoading]);

  useEffect(() => {
    if (!selectedSavedAddress) return;
    setAddress((current) => current.trim() || current);
  }, [selectedSavedAddress]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isConfirming) return;

    const missingFields: string[] = [];
    if (!customerName.trim()) missingFields.push("Nombre completo");
    if (!email.trim()) missingFields.push("Email");
    if (!phone.trim()) missingFields.push("Teléfono");
    if (!street.trim()) missingFields.push("Calle");
    if (!streetNumber.trim()) missingFields.push("Altura");
    if (!address.trim()) missingFields.push("Entre calles");
    if (!city.trim()) missingFields.push("Ciudad");
    if (!province.trim()) missingFields.push("Provincia");
    if (!postalCode.trim()) missingFields.push("Código Postal");
    brandSlugs.forEach((slug) => {
      if (!shippingMethodsByBrand[slug])
        missingFields.push(`Método de envío de ${getBrand(slug)?.name}`);
      if (!paymentMethodsByBrand[slug])
        missingFields.push(`Método de pago de ${getBrand(slug)?.name}`);
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
    if (!canProceedToCheckout) {
      setValidationMessage(
        "No podés continuar: algún producto no está reservado a tu nombre o se quedó sin stock. Volvé al carrito para revisar el tiempo y la disponibilidad.",
      );
      return;
    }
    if (!reservationOwnerId) {
      setValidationMessage("No se pudo validar tu sesión. Recargá el carrito antes de pagar.");
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
    const normalizedAddress = [street, streetNumber, address, addressReferences]
      .filter(Boolean)
      .join(" ")
      .trim();
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
      address: normalizedAddress,
      extraInfo: notes,
      date: new Date().toISOString().slice(0, 10),
      total,
      paymentDiscount: 0,
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
        ...(item.priceCurrency ? { priceCurrency: item.priceCurrency } : {}),
        ...(item.gastos !== undefined ? { gastos: item.gastos } : {}),
        ...(item.gastosCurrency ? { gastosCurrency: item.gastosCurrency } : {}),
        ...(item.usdRate !== undefined ? { usdRate: item.usdRate } : {}),
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
          address: normalizedAddress,
          notes,
          total,
          paymentDiscount: 0,
          expenses,
          profit: total - expenses,
          paymentMethod: combinedPaymentMethod,
          installments: isCardPayment ? selectedInstallments : 1,
          discountCode: couponApplied ? couponCode.trim().toUpperCase() : undefined,
          cardFee,
          paymentTotal: mercadoPagoTotal,
          paymentItems: mercadoPagoItems,
          shippingMethod: combinedShippingMethod,
          isGuest: !isAuthenticated,
          reservationOwnerId,
          ...(!isAuthenticated ? { guestCustomerId: id } : {}),
          items: order.items.map((item) => ({
            ...(item.productId ? { productId: item.productId } : {}),
            ...(item.variantId ? { variantId: item.variantId } : {}),
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

    try {
      await orderService.create(order, reservationOwnerId);
      const orderQueryKey = ["orders"] as const;
      queryClient.invalidateQueries({ queryKey: orderQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      setOrderId(id);
      clear();
      setStep("done");
    } catch (error) {
      setIsConfirming(false);
      setValidationMessage(
        error instanceof Error ? error.message : "No se pudo confirmar el stock de la compra.",
      );
    }
  }

  if (step === "done") {
    return (
      <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
        {Header}
        <main className="flex min-h-screen items-start justify-center px-4 pb-8 pt-20 sm:px-6">
          <div className="fixed inset-0 z-100 flex items-center justify-center bg-background/80 px-4 backdrop-blur-md">
            <div
              className="glass-panel w-full max-w-2xl rounded-3xl p-8 text-center shadow-2xl sm:p-12"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checkout-complete-title"
            >
              <CheckCircle2 className="mx-auto size-12 text-primary" />
              <h1 id="checkout-complete-title" className="font-display mt-6 text-3xl font-semibold">
                ¡Gracias por tu compra!
              </h1>
              <p className="mt-3 text-muted-foreground">
                Tu pedido <span className="text-foreground">{orderId}</span> fue confirmado.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                En unos segundos vas a ser redirigido al catálogo completo de la tienda.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/productos" replace>
                    <ShoppingBag className="size-4" /> Seguir comprando
                  </Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/cuenta/compras" replace>
                    <Package className="size-4" /> Ver mis compras
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
      {Header}
      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-20 sm:px-6">
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

        {activeReservationCountdowns.length > 0 ? (
          <div
            className="mb-4 space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
            role="status"
            aria-live="polite"
          >
            {activeReservationCountdowns.map(({ name, countdown }) => (
              <p key={name}>
                Tenés prioridad para comprar <strong>{name}</strong> durante {countdown}.
              </p>
            ))}
          </div>
        ) : null}

        <form
          ref={checkoutFormRef}
          onSubmit={submit}
          noValidate
          aria-busy={!brandSettingsReady || stockReservationsLoading}
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
          {!paymentApproved && blockedReservation ? (
            <div
              className="lg:col-span-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
              role="status"
              aria-live="polite"
            >
              {stockReservationsLoading
                ? "Verificando la prioridad de compra de tu carrito…"
                : stockReservationStatuses[blockedReservation.id]?.state === "waiting"
                  ? `Otro comprador tiene prioridad sobre «${blockedReservation.name}». ${stockReservationStatuses[blockedReservation.id]?.queuePosition ? `Estás en el lugar ${stockReservationStatuses[blockedReservation.id]?.queuePosition} de espera. ` : "Esperá a que se libere el producto. "}Volvé al carrito para seguir el tiempo.`
                  : stockReservationStatuses[blockedReservation.id]?.state === "sold"
                    ? `«${blockedReservation.name}» ya no tiene stock porque otro cliente lo compró.`
                    : stockReservationStatuses[blockedReservation.id]?.state === "expired"
                      ? `Venció la prioridad para «${blockedReservation.name}». Volvé al carrito para revisar si sigue disponible.`
                      : `No se pudo confirmar la reserva de «${blockedReservation.name}». Volvé al carrito para actualizar el stock.`}
            </div>
          ) : null}
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
                    <Label>Dirección a enviar</Label>
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
                              const parsedAddress = splitStreetAndNumber(addr.value);
                              setStreet(addr.street || parsedAddress.street || "");
                              setStreetNumber(
                                addr.streetNumber || parsedAddress.streetNumber || "",
                              );
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
                  <div className="grid gap-3 pt-2">
                    <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-[2.2fr_1fr_2.2fr_1fr_1fr]">
                      {(
                        [
                          ["Calle", street, setStreet, false],
                          ["Altura", streetNumber, setStreetNumber, false],
                          ["Entre calles", address, setAddress, false],
                          ["Piso", floor, setFloor, false],
                          ["Depto", apartment, setApartment, false],
                        ] as Array<[string, string, (next: string) => void, boolean]>
                      ).map(([label, value, setter, synced]) => (
                        <label key={String(label)} className="space-y-1 text-sm">
                          <span>{label}</span>
                          <Input
                            value={String(value)}
                            onChange={(event) => {
                              (setter as (next: string) => void)(event.target.value);
                              setSelectedSavedAddress("");
                            }}
                            readOnly={Boolean(synced)}
                            className={synced ? "h-10 bg-muted/40" : "h-10"}
                          />
                        </label>
                      ))}
                    </div>

                    <div className="hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-[minmax(7rem,1.1fr)_2fr_2fr_3fr]">
                      {(
                        [
                          ["Código Postal", postalCode, setPostalCode, false],
                          ["Ciudad", city, setCity, false],
                          ["Provincia", province, setProvince, false],
                          ["Referencias", addressReferences, setAddressReferences, false],
                        ] as Array<[string, string, (next: string) => void, boolean]>
                      ).map(([label, value, setter, synced]) => (
                        <label key={String(label)} className="space-y-1 text-sm">
                          <span>{label}</span>
                          <Input
                            value={String(value)}
                            onChange={(event) => {
                              (setter as (next: string) => void)(event.target.value);
                              setSelectedSavedAddress("");
                            }}
                            readOnly={Boolean(synced)}
                            className={synced ? "h-10 bg-muted/40" : "h-10"}
                            placeholder={
                              label === "Referencias"
                                ? "Referencias del domicilio."
                                : undefined
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:hidden">
                      {(
                        [
                          ["Depto", apartment, setApartment, false],
                          ["Código Postal", postalCode, setPostalCode, false],
                          ["Ciudad", city, setCity, false],
                          ["Provincia", province, setProvince, false],
                        ] as Array<[string, string, (next: string) => void, boolean]>
                      ).map(([label, value, setter, synced]) => (
                        <label key={String(label)} className="space-y-1 text-sm">
                          <span>{label}</span>
                          <Input
                            value={String(value)}
                            onChange={(event) => {
                              (setter as (next: string) => void)(event.target.value);
                              setSelectedSavedAddress("");
                            }}
                            readOnly={Boolean(synced)}
                            className={synced ? "h-10 bg-muted/40" : "h-10"}
                          />
                        </label>
                      ))}
                    </div>
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
                    {/transferencia/i.test(paymentMethodsByBrand[slug] ?? "") && bankCbus[slug] && (
                      <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
                        <p className="font-semibold">Datos para transferencia bancaria</p>
                        <p className="mt-1 text-muted-foreground">CBU: {bankCbus[slug]}</p>
                        <p className="mt-2 text-muted-foreground">
                          Enviar comprobante por WhatsApp o Correo electrónico
                        </p>
                      </div>
                    )}
                  </div>
                ))}
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
                  {items.map((item) => {
                    const lineTotal = item.price * item.quantity;
                    return (
                      <div key={item.id} className="space-y-1.5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 font-medium text-foreground">{item.name}</p>
                          <div className="shrink-0 text-right">
                            <span className="font-semibold text-foreground">
                              {formatPrice(lineTotal)}
                            </span>
                          </div>
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
                    );
                  })}
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
                        {shippingMethodsByBrand[slug] || "A confirmar"}
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
                      <span>
                        {[
                          couponPercentage > 0 ? `${couponPercentage}%` : null,
                          couponAmount > 0 ? `$${couponAmount}` : null,
                        ]
                          .filter(Boolean)
                          .join(" + ") || "0"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-green-600">
                      <span>Descuento</span>
                      <span>-{formatPrice(couponDiscountAmount)}</span>
                    </div>
                  </>
                )}
                {hasCashOrTransferPayment && (
                  <div className="mt-3 flex items-center justify-between text-muted-foreground">
                    <span>Transferencia/efectivo</span>
                    <span>Sin recargo</span>
                  </div>
                )}
                {isCardPayment && cardFee > 0 && (
                  <div className="mt-3 flex items-center justify-between text-muted-foreground">
                    <span>Recargo por tarjeta/Mercado Pago (15%)</span>
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
                disabled={
                  isConfirming ||
                  !brandSettingsReady ||
                  (!paymentApproved && !canProceedToCheckout)
                }
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
