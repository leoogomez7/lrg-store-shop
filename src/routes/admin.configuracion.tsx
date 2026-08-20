import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, CreditCard, Package, Pencil, Settings, Store, Tag, Trash2, Truck, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  BrandPaymentMethod,
  brandList,
  getBrand,
  setBrandCategories,
  setBrandPaymentMethods,
  setBrandShippingConfig,
} from "@/config/brands";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/configuracion")({
  head: () => ({
    meta: [
      { title: "LRG Store Shop - Administrador" },
      { name: "description", content: "Ajustes generales del admin: categorías, envíos y más." },
      { property: "og:title", content: "LRG Store Shop - Administrador" },
      { property: "og:description", content: "Administrá categorías, envíos y ajustes del negocio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminConfiguration,
});

function AdminConfiguration() {
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(300);
  const [pendingFreeShippingThreshold, setPendingFreeShippingThreshold] = useState(String(300));
  const [freeShippingConfirmationStatus, setFreeShippingConfirmationStatus] = useState<"confirmed" | "unchanged" | null>(null);
  const [freeShippingConfirmed, setFreeShippingConfirmed] = useState(false);
  const [applyFreeShippingToAll, setApplyFreeShippingToAll] = useState(false);
  const [applyShippingMethodsToAll, setApplyShippingMethodsToAll] = useState(false);
  const [applyPaymentMethodsToAll, setApplyPaymentMethodsToAll] = useState(false);
  const [newShippingMethod, setNewShippingMethod] = useState("");
  const [shippingMethods, setShippingMethods] = useState<BrandPaymentMethod[]>([]);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editingMethodName, setEditingMethodName] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<BrandPaymentMethod[]>([]);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const [editingPaymentMethodName, setEditingPaymentMethodName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState(brandList[0]?.slug ?? "");
  const [categories, setCategories] = useState(() => {
    const current = brandList.find((brand) => brand.slug === selectedBrand)?.categories ?? [];
    return current.map((category) => ({
      id: category.slug,
      name: category.name,
      description: category.description ?? "",
      enabled: true,
    }));
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const loadBrandSettings = (brandSlug: string) => {
    const brand = getBrand(brandSlug);
    if (!brand) return;

    syncCategoriesToSelectedBrand(brandSlug);

    setPaymentMethods(
      brand.paymentMethods?.length
        ? brand.paymentMethods
        : brand.payments.map((name) => ({
            id: name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, ""),
            name,
            enabled: true,
          })),
    );

    setShippingMethods(
      brand.shipping?.methods ?? [
        { id: "physical", name: "Físico", enabled: true },
        { id: "digital", name: "Digital", enabled: true },
        { id: "whatsapp", name: "WhatsApp", enabled: true },
      ],
    );

    setFreeShippingThreshold(brand.shipping?.freeShippingThreshold ?? 300);
    setPendingFreeShippingThreshold(String(brand.shipping?.freeShippingThreshold ?? 300));
    setFreeShippingConfirmationStatus(null);
    setFreeShippingConfirmed(false);
    setIsInitialized(true);
  };

  useEffect(() => {
    if (!selectedBrand) return;
    loadBrandSettings(selectedBrand);
  }, [selectedBrand]);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategorySubtitle, setEditingCategorySubtitle] = useState("");

  const persistCategories = (nextCategories: typeof categories) => {
    const selectedBrandConfig = brandList.find((brand) => brand.slug === selectedBrand);
    if (!selectedBrandConfig) return;

    const updatedCategories = nextCategories.map((category) => ({
      slug: category.id || category.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      name: category.name.trim(),
      description: category.description?.trim() || category.name.trim(),
    }));

    setBrandCategories(selectedBrandConfig.slug, updatedCategories);
    setCategories(nextCategories);
  };

  const syncCategoriesToSelectedBrand = (brandSlug: string) => {
    const current = brandList.find((brand) => brand.slug === brandSlug)?.categories ?? [];
    setCategories(
      current.map((category) => ({
        id: category.slug,
        name: category.name,
        description: category.description ?? "",
        enabled: true,
      })),
    );
  };

  const addShippingMethod = () => {
    const trimmed = newShippingMethod.trim();
    if (!trimmed) return;

    const next = [
      ...shippingMethods,
      { id: `${Date.now()}-${trimmed}`, name: trimmed, enabled: true, codeRequired: false },
    ];

    setShippingMethods(next);
    setNewShippingMethod("");

    if (isInitialized) {
      persistShippingConfig(next);
    }
  };

  const confirmFreeShippingThreshold = () => {
    const trimmed = pendingFreeShippingThreshold.trim();
    const parsed = Number(trimmed);
    if (!trimmed || Number.isNaN(parsed) || parsed < 0) return;

    if (applyFreeShippingToAll) {
      brandList.forEach((brand) => {
        setBrandShippingConfig(brand.slug, {
          freeShippingThreshold: parsed,
          methods: brand.shipping?.methods ?? [],
        });
      });
    } else if (selectedBrand) {
      setBrandShippingConfig(selectedBrand, {
        freeShippingThreshold: parsed,
        methods: shippingMethods,
      });
    }

    setFreeShippingConfirmationStatus(parsed === freeShippingThreshold ? "unchanged" : "confirmed");
    setFreeShippingThreshold(parsed);
    setFreeShippingConfirmed(true);

    toast.success("Envío gratis confirmado", {
      description: applyFreeShippingToAll
        ? `Desde $${parsed} en todas las tiendas`
        : `Desde $${parsed}`,
    });
  };

  const toggleShippingMethod = (id: string) => {
    setShippingMethods((current) => {
      const next = current.map((method) =>
        method.id === id ? { ...method, enabled: !method.enabled } : method,
      );
      if (isInitialized) {
        persistShippingConfig(next);
      }
      return next;
    });
  };

  const toggleShippingMethodCodeRequired = (id: string) => {
    setShippingMethods((current) => {
      const next = current.map((method) =>
        method.id === id ? { ...method, codeRequired: !method.codeRequired } : method,
      );
      if (isInitialized) {
        persistShippingConfig(next);
      }
      return next;
    });
  };

  const startEditingMethod = (method: { id: string; name: string }) => {
    setEditingMethodId(method.id);
    setEditingMethodName(method.name);
  };

  const saveEditedMethod = (id: string) => {
    const trimmed = editingMethodName.trim();
    if (!trimmed) return;
    setShippingMethods((current) => {
      const next = current.map((method) =>
        method.id === id ? { ...method, name: trimmed } : method,
      );
      if (isInitialized) {
        persistShippingConfig(next);
      }
      return next;
    });
    setEditingMethodId(null);
    setEditingMethodName("");
  };

  const removeShippingMethod = (id: string) => {
    setShippingMethods((current) => {
      const next = current.filter((method) => method.id !== id);
      if (isInitialized && selectedBrand) {
        setBrandShippingConfig(selectedBrand, {
          freeShippingThreshold,
          methods: next,
        });
      }
      return next;
    });
  };

  const persistShippingConfig = (methods: BrandPaymentMethod[], threshold = freeShippingThreshold) => {
    if (!selectedBrand) return;
    setBrandShippingConfig(selectedBrand, {
      freeShippingThreshold: threshold,
      methods,
    });
  };

  const persistPaymentMethods = (methods: BrandPaymentMethod[]) => {
    if (!selectedBrand) return;
    setBrandPaymentMethods(selectedBrand, methods);
  };

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: undefined, onConfirm: () => {} });

  const togglePaymentMethod = (id: string) => {
    setPaymentMethods((current) => {
      const next = current.map((method) =>
        method.id === id ? { ...method, enabled: !method.enabled } : method,
      );
      if (isInitialized) {
        persistPaymentMethods(next);
      }
      return next;
    });
  };

  const startEditingPaymentMethod = (method: { id: string; name: string }) => {
    setEditingPaymentMethodId(method.id);
    setEditingPaymentMethodName(method.name);
  };

  const saveEditedPaymentMethod = (id: string) => {
    const trimmed = editingPaymentMethodName.trim();
    if (!trimmed) return;
    setPaymentMethods((current) => {
      const next = current.map((method) =>
        method.id === id ? { ...method, name: trimmed } : method,
      );
      if (isInitialized) {
        persistPaymentMethods(next);
      }
      return next;
    });
    setEditingPaymentMethodId(null);
    setEditingPaymentMethodName("");
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods((current) => {
      const next = current.filter((method) => method.id !== id);
      if (isInitialized) {
        persistPaymentMethods(next);
      }
      return next;
    });
  };

  const addPaymentMethod = () => {
    const trimmed = newPaymentMethod.trim();
    if (!trimmed) return;

    const next = [
      ...paymentMethods,
      {
        id: `${Date.now()}-${trimmed}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        name: trimmed,
        enabled: true,
      },
    ];

    setPaymentMethods(next);
    setNewPaymentMethod("");
    if (isInitialized) {
      persistPaymentMethods(next);
    }
  };

  const normalizePaymentMethods = (methods: BrandPaymentMethod[]) =>
    methods
      .map((method) => ({ id: method.id, name: method.name.trim(), enabled: method.enabled }))
      .sort((a, b) => a.id.localeCompare(b.id));

  const normalizeShippingMethods = (methods: BrandPaymentMethod[]) =>
    methods
      .map((method) => ({
        id: method.id,
        name: method.name.trim(),
        enabled: method.enabled,
        codeRequired: Boolean(method.codeRequired),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

  const paymentMethodsAppliedToAll = useMemo(() => {
    const current = normalizePaymentMethods(paymentMethods);
    return brandList.every((brand) => {
      const brandMethods = brand.paymentMethods?.length
        ? brand.paymentMethods
        : brand.payments.map((name) => ({
            id: name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, ""),
            name,
            enabled: true,
          }));
      const normalizedBrandMethods = normalizePaymentMethods(brandMethods);
      if (normalizedBrandMethods.length !== current.length) return false;
      return normalizedBrandMethods.every(
        (method, index) =>
          method.id === current[index].id &&
          method.name === current[index].name &&
          method.enabled === current[index].enabled,
      );
    });
  }, [paymentMethods]);

  const shippingMethodsAppliedToAll = useMemo(() => {
    const current = normalizeShippingMethods(shippingMethods);
    return brandList.every((brand) => {
      const brandMethods = brand.shipping?.methods ?? [];
      const normalizedBrandMethods = normalizeShippingMethods(brandMethods);
      if (normalizedBrandMethods.length !== current.length) return false;
      return normalizedBrandMethods.every(
        (method, index) =>
          method.id === current[index].id &&
          method.name === current[index].name &&
          method.enabled === current[index].enabled &&
          method.codeRequired === current[index].codeRequired,
      );
    });
  }, [shippingMethods]);

  const applyPaymentMethodsToAllConfirm = () => {
    brandList.forEach((brand) => {
      setBrandPaymentMethods(brand.slug, paymentMethods);
    });
    setApplyPaymentMethodsToAll(false);
    toast.success("Métodos de pago aplicados a todas las tiendas", {
      description: `Se sincronizaron ${paymentMethods.length} métodos en todas las tiendas.`,
    });
  };

  const applyShippingMethodsToAllConfirm = () => {
    brandList.forEach((brand) => {
      setBrandShippingConfig(brand.slug, {
        freeShippingThreshold: brand.shipping?.freeShippingThreshold ?? freeShippingThreshold,
        methods: shippingMethods,
      });
    });
    setApplyShippingMethodsToAll(false);
    toast.success("Métodos de envío aplicados a todas las tiendas", {
      description: `Se sincronizaron ${shippingMethods.length} métodos en todas las tiendas.`,
    });
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    const next = [
      ...categories,
      {
        id: `${Date.now()}-${trimmed}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        name: trimmed,
        description: "",
        enabled: true,
      },
    ];
    persistCategories(next);
    setNewCategory("");
  };

  const toggleCategory = (id: string) => {
    const next = categories.map((category) =>
      category.id === id ? { ...category, enabled: !category.enabled } : category,
    );
    persistCategories(next);
  };

  const startEditingCategory = (category: { id: string; name: string; description?: string }) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setEditingCategorySubtitle(category.description ?? "");
  };

  const saveEditedCategory = (id: string) => {
    const trimmed = editingCategoryName.trim();
    if (!trimmed) return;
    const next = categories.map((category) =>
      category.id === id
        ? { ...category, name: trimmed, description: editingCategorySubtitle.trim() }
        : category,
    );
    persistCategories(next);
    setEditingCategoryId(null);
    setEditingCategoryName("");
    setEditingCategorySubtitle("");
  };

  const removeCategory = (id: string) => {
    const next = categories.filter((category) => category.id !== id);
    persistCategories(next);
  };

  const handleBrandChange = (brandSlug: string) => {
    if (selectedBrand && isInitialized) {
      persistShippingConfig(shippingMethods, freeShippingThreshold);
      persistPaymentMethods(paymentMethods);
    }
    setSelectedBrand(brandSlug);
  };

  const selectedBrandName = brandList.find((brand) => brand.slug === selectedBrand)?.name ?? "Sin tienda seleccionada";

  useEffect(() => {
    return () => {
      if (selectedBrand && isInitialized) {
        persistShippingConfig(shippingMethods, freeShippingThreshold);
        persistPaymentMethods(paymentMethods);
      }
    };
  }, [selectedBrand, isInitialized, shippingMethods, paymentMethods, freeShippingThreshold]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>

        <ConfirmDialog
          open={confirmState.open}
          onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => {
            confirmState.onConfirm();
            setConfirmState((s) => ({ ...s, open: false }));
          }}
        />
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Configuración</p>
          <h1 className="mt-2 text-3xl font-semibold">Ajustes del panel</h1>
        </div>
      </div>

      <section className="mt-10 rounded-3xl border border-border/60 bg-surface/90 p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Tienda a configurar</h2>
            <p className="text-sm text-muted-foreground">Elegí la tienda a configurar.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {brandList.map((brand) => {
            const active = selectedBrand === brand.slug;
            return (
              <button
                key={brand.slug}
                type="button"
                onClick={() => handleBrandChange(brand.slug)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                  active
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/60 bg-background/90 text-foreground hover:bg-background/95",
                )}
              >
                {brand.name}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Envíos</h2>
              <p className="text-sm text-muted-foreground">Configurar las condiciones de envío.</p>
            </div>
          </div>



            <div>
              <Label htmlFor="freeShippingThreshold">Envío gratis desde ($)</Label>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Input
                  id="freeShippingThreshold"
                  type="number"
                  value={pendingFreeShippingThreshold}
                  onChange={(event) => setPendingFreeShippingThreshold(event.target.value)}
                  className="h-9 min-w-0 w-[28%] max-w-42.5"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                    <span className="text-sm">Aplicar a todas las tiendas</span>
                    <Switch checked={applyFreeShippingToAll} onCheckedChange={setApplyFreeShippingToAll} />
                  </label>
                  <Button
                    size="sm"
                    onClick={confirmFreeShippingThreshold}
                    disabled={pendingFreeShippingThreshold.trim().length === 0 || Number.isNaN(Number(pendingFreeShippingThreshold))}
                    className="h-9 shrink-0 gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Confirmar
                  </Button>
                </div>
              </div>
            </div>

          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-border/50 bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Hay envío gratis desde:</p>
              <p className="mt-2 text-lg font-semibold text-foreground">${freeShippingThreshold}</p>
            </div>


            <div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  id="newShippingMethod"
                  value={newShippingMethod}
                  onChange={(event) => setNewShippingMethod(event.target.value)}
                  placeholder="Escribir nuevo método de envío"
                  className="h-9 min-w-0 w-[70%] max-w-107.5"
                />
                <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                  <span className="text-sm">Aplicar a todas las tiendas</span>
                  <Switch checked={applyShippingMethodsToAll} onCheckedChange={setApplyShippingMethodsToAll} />
                </label>
                  <Button
                    size="sm"
                    onClick={addShippingMethod}
                    disabled={!newShippingMethod.trim()}
                    className="h-9 shrink-0 gap-2"
                  >
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
              </div>
            </div>

            <div className="grid gap-3">
              {shippingMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                    {editingMethodId === method.id ? (
                        <Input
                        value={editingMethodName}
                        onChange={(event) => setEditingMethodName(event.target.value)}
                        className="min-w-35"
                      />
                    ) : (
                      method.name
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingMethodId === method.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveEditedMethod(method.id)}
                          disabled={!editingMethodName.trim() || editingMethodName.trim() === method.name}
                          className="h-8 gap-1 rounded-md border border-transparent bg-transparent px-2 text-sm text-green-600 shadow-none hover:bg-green-100/80 hover:text-green-700 hover:shadow-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-green-700/40 disabled:opacity-100"
                        >
                          <Check className="h-4 w-4" />
                          Guardar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMethodId(null);
                            setEditingMethodName("");
                          }}
                          className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                            <span className="text-sm">{method.enabled ? "Disponible" : "No disponible"}</span>
                            <Switch
                              checked={method.enabled}
                              onCheckedChange={() => toggleShippingMethod(method.id)}
                            />
                          </label>
                          <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                            <span className="text-sm">Requiere código</span>
                            <Switch
                              checked={Boolean(method.codeRequired)}
                              onCheckedChange={() => toggleShippingMethodCodeRequired(method.id)}
                            />
                          </label>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingMethod(method)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Eliminar "${method.name}"?`,
                              description: "Esta acción no se puede deshacer.",
                              onConfirm: () => removeShippingMethod(method.id),
                            })
                          }
                          className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                onClick={applyShippingMethodsToAllConfirm}
                disabled={!applyShippingMethodsToAll || shippingMethodsAppliedToAll}
                className="h-9 shrink-0 gap-2"
              >
                <Check className="h-4 w-4" />
                Confirmar
              </Button>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Métodos de pago</h2>
              <p className="text-sm text-muted-foreground">Configurar los métodos de pago disponibles.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                id="newPaymentMethod"
                value={newPaymentMethod}
                onChange={(event) => setNewPaymentMethod(event.target.value)}
                placeholder="Escribir nuevo método de pago"
                className="h-9 min-w-0 w-[70%] max-w-107.5"
              />
              <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                <span className="text-sm">Aplicar a todas las tiendas</span>
                <Switch checked={applyPaymentMethodsToAll} onCheckedChange={setApplyPaymentMethodsToAll} />
              </label>
              <Button
                size="sm"
                onClick={addPaymentMethod}
                disabled={!newPaymentMethod.trim()}
                className="h-9 shrink-0 gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="grid gap-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                    {editingPaymentMethodId === method.id ? (
                        <Input
                        value={editingPaymentMethodName}
                        onChange={(event) => setEditingPaymentMethodName(event.target.value)}
                        className="min-w-35 w-full"
                      />
                    ) : (
                      method.name
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingPaymentMethodId === method.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveEditedPaymentMethod(method.id)}
                          disabled={!editingPaymentMethodName.trim() || editingPaymentMethodName.trim() === method.name}
                          className="h-8 gap-1 rounded-md border border-transparent bg-transparent px-2 text-sm text-green-600 shadow-none hover:bg-green-100/80 hover:text-green-700 hover:shadow-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-green-700/40 disabled:opacity-100"
                        >
                          <Check className="h-4 w-4" />
                          Guardar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPaymentMethodId(null);
                            setEditingPaymentMethodName("");
                          }}
                          className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                          <span className="text-sm">{method.enabled ? "Disponible" : "No disponible"}</span>
                          <Switch
                            checked={method.enabled}
                            onCheckedChange={() => togglePaymentMethod(method.id)}
                          />
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingPaymentMethod(method)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Eliminar "${method.name}"?`,
                              description: "Esta acción no se puede deshacer.",
                              onConfirm: () => removePaymentMethod(method.id),
                            })
                          }
                          className="gap-2 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                  size="sm"
                  onClick={applyPaymentMethodsToAllConfirm}
                  disabled={!applyPaymentMethodsToAll || paymentMethodsAppliedToAll}
                  className="h-9 shrink-0 gap-2"
                >
                <Check className="h-4 w-4" />
                Confirmar
              </Button>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Tag className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Categorías</h2>
              <p className="text-sm text-muted-foreground">Configurar las categorías que aparecen en las tiendas.</p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                id="newCategory"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                placeholder="Escribir nueva categoría"
                className="h-9 min-w-0 w-[70%] max-w-107.5"
              />
              <Button onClick={addCategory} size="sm" disabled={!newCategory.trim()} className="h-9 shrink-0 gap-2">
                  <Plus className="h-4 w-4" />
                  Agregar
                </Button>
            </div>

            <div className="grid gap-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                    {editingCategoryId === category.id ? (
                      <div className="grid w-full gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor={`category-name-${category.id}`}>Nombre categoría</Label>
                          <Input
                            id={`category-name-${category.id}`}
                            value={editingCategoryName}
                            onChange={(event) => setEditingCategoryName(event.target.value)}
                            className="min-w-35 w-full"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`category-description-${category.id}`}>Descripción</Label>
                          <Input
                            id={`category-description-${category.id}`}
                            value={editingCategorySubtitle}
                            onChange={(event) => setEditingCategorySubtitle(event.target.value)}
                            aria-label={`Descripción de ${category.name}`}
                            className="min-w-35 w-full"
                          />
                        </div>
                      </div>
                    ) : (
                      category.name
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingCategoryId === category.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveEditedCategory(category.id)}
                          disabled={
                            !editingCategoryName.trim() ||
                            (editingCategoryName.trim() === category.name &&
                              editingCategorySubtitle.trim() === (category.description ?? "").trim())
                          }
                          className="h-8 gap-1 rounded-md border border-transparent bg-transparent px-2 text-sm text-green-600 shadow-none hover:bg-green-100/80 hover:text-green-700 hover:shadow-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-green-700/40 disabled:opacity-100"
                        >
                          <Check className="h-4 w-4" />
                          Guardar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCategoryId(null);
                            setEditingCategoryName("");
                            setEditingCategorySubtitle("");
                          }}
                          className="gap-2 text-destructive hover:bg-destructive/10"
                        >
                          <X className="h-4 w-4" />
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                          <span className="text-sm">{category.enabled ? "Disponible" : "No disponible"}</span>
                          <Switch checked={category.enabled} onCheckedChange={() => toggleCategory(category.id)} />
                        </label>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditingCategory(category)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-2 text-destructive hover:bg-destructive/10"
                          onClick={() =>
                            setConfirmState({
                              open: true,
                              title: `Eliminar "${category.name}"?`,
                              description: "Esta acción no se puede deshacer.",
                              onConfirm: () => removeCategory(category.id),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

    </main>
  );
}
