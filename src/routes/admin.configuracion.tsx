import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgePercent,
  Check,
  CreditCard,
  Landmark,
  Package,
  Pencil,
  Settings,
  Store,
  Tag,
  Tags,
  Trash2,
  Truck,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  BrandPaymentMethod,
  type BrandDiscount,
  brandList,
  getBrand,
  setBrandCategories,
  setBrandPaymentMethods,
  setBrandShippingConfig,
  setBrandDiscounts,
  type BrandSlug,
} from "@/config/brands";
import { cn } from "@/lib/utils";
import { loadAdminSettings, saveAdminSetting } from "@/server/persistence";

export const Route = createFileRoute("/admin/configuracion")({
  head: () => ({
    meta: [
      { title: "Administrador" },
      { name: "description", content: "Ajustes generales del admin: categorías, envíos y más." },
      { property: "og:title", content: "Administrador" },
      {
        property: "og:description",
        content: "Administrá categorías, envíos y ajustes del negocio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminConfiguration,
});

function AdminConfiguration() {
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(300);
  const [pendingFreeShippingThreshold, setPendingFreeShippingThreshold] = useState("");
  const [freeShippingConfirmationStatus, setFreeShippingConfirmationStatus] = useState<
    "confirmed" | "unchanged" | null
  >(null);
  const [freeShippingConfirmed, setFreeShippingConfirmed] = useState(false);
  const [applyFreeShippingToAll, setApplyFreeShippingToAll] = useState(false);
  const [applyShippingMethodsToAll, setApplyShippingMethodsToAll] = useState(false);
  const [applyPaymentMethodsToAll, setApplyPaymentMethodsToAll] = useState(false);
  const [newShippingMethod, setNewShippingMethod] = useState("");
  const [shippingMethods, setShippingMethods] = useState<BrandPaymentMethod[]>([]);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editingMethodName, setEditingMethodName] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [bankCbu, setBankCbu] = useState("");
  const [bankCbus, setBankCbus] = useState<Partial<Record<BrandSlug, string>>>({});
  const [applyBankCbuToAll, setApplyBankCbuToAll] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<BrandPaymentMethod[]>([]);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const [editingPaymentMethodName, setEditingPaymentMethodName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [subcategoryDialogCategoryId, setSubcategoryDialogCategoryId] = useState<string | null>(
    null,
  );
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [editingSubcategoryKey, setEditingSubcategoryKey] = useState<string | null>(null);
  const [editingSubcategoryName, setEditingSubcategoryName] = useState("");
  const [newDiscountCode, setNewDiscountCode] = useState("");
  const [newDiscountPercentage, setNewDiscountPercentage] = useState<number | string>("");
  const [discounts, setDiscounts] = useState<BrandDiscount[]>([]);
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

    setPaymentMethods(brand.paymentMethods?.length ? brand.paymentMethods : []);

    setShippingMethods(brand.shipping?.methods ?? []);

    setDiscounts(brand.discounts ?? []);

    const shippingThreshold = brand.shipping?.freeShippingThreshold ?? 300;
    setFreeShippingThreshold(shippingThreshold);
    setPendingFreeShippingThreshold(shippingThreshold > 0 ? String(shippingThreshold) : "");
    setFreeShippingConfirmationStatus(null);
    setFreeShippingConfirmed(false);
    setIsInitialized(true);
  };

  useEffect(() => {
    if (!selectedBrand) return;
    loadBrandSettings(selectedBrand);
  }, [selectedBrand]);

  useEffect(() => {
    void loadAdminSettings({ data: {} }).then((settings) => {
      const setting = settings.find((item) => item.settingKey === "lrg:bank-cbu");
      if (!setting) return;
      try {
        const parsed = JSON.parse(setting.settingValue) as Partial<Record<BrandSlug, string>>;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setBankCbus(parsed);
          setBankCbu(parsed[selectedBrand] ?? "");
          return;
        }
      } catch {
        // Migrate the previous single global CBU value below.
      }
      const migratedCbus = {
        arcade: setting.settingValue,
        scents: setting.settingValue,
        "web-design": setting.settingValue,
      };
      setBankCbus(migratedCbus);
      setBankCbu(setting.settingValue);
    });
  }, [selectedBrand]);

  useEffect(() => {
    setBankCbu(bankCbus[selectedBrand] ?? "");
  }, [bankCbus, selectedBrand]);

  const saveBankCbu = () => {
    const value = bankCbu.trim();
    const next = applyBankCbuToAll
      ? { arcade: value, scents: value, "web-design": value }
      : { ...bankCbus, [selectedBrand]: value };
    setBankCbus(next);
    void saveAdminSetting({
      data: { settingKey: "lrg:bank-cbu", settingValue: JSON.stringify(next) },
    });
    toast.success("CBU guardado");
  };

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editingCategorySubtitle, setEditingCategorySubtitle] = useState("");

  const persistCategories = (nextCategories: typeof categories) => {
    const selectedBrandConfig = brandList.find((brand) => brand.slug === selectedBrand);
    if (!selectedBrandConfig) return;

    const updatedCategories = nextCategories.map((category) => ({
      slug:
        category.id ||
        category.name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      name: category.name.trim(),
      description: category.description?.trim() || category.name.trim(),
      subcategories: category.subcategories ?? [],
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
        subcategories: category.subcategories ?? [],
        enabled: true,
      })),
    );
  };

  const persistDiscounts = (nextDiscounts: BrandDiscount[]) => {
    setDiscounts(nextDiscounts);
    if (isInitialized) setBrandDiscounts(selectedBrand as BrandSlug, nextDiscounts);
  };

  const addDiscount = () => {
    const code = newDiscountCode.trim().toUpperCase();
    const percentage = Math.max(1, Math.min(100, Number(newDiscountPercentage) || 0));
    if (!code || !percentage || discounts.some((discount) => discount.code === code)) return;
    persistDiscounts([
      ...discounts,
      { id: `${Date.now()}-${code}`, code, percentage, enabled: true },
    ]);
    setNewDiscountCode("");
    setNewDiscountPercentage("");
    toast.success("Descuento agregado", {
      description: `${code} aplica ${percentage}% en ${getBrand(selectedBrand)?.name}.`,
    });
  };

  const toggleDiscount = (id: string) => {
    persistDiscounts(
      discounts.map((discount) =>
        discount.id === id ? { ...discount, enabled: !discount.enabled } : discount,
      ),
    );
  };

  const removeDiscount = (id: string) => {
    persistDiscounts(discounts.filter((discount) => discount.id !== id));
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

  const persistShippingConfig = (
    methods: BrandPaymentMethod[],
    threshold = freeShippingThreshold,
  ) => {
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

  type SubcategoryNode = {
    slug: string;
    name: string;
    children?: SubcategoryNode[];
  };

  const appendSubcategoryToTree = (
    items: SubcategoryNode[] = [],
    parentSlug: string | null,
    name: string,
  ): SubcategoryNode[] => {
    const cleanName = name.trim();
    if (!cleanName) return items;

    const node: SubcategoryNode = {
      slug: `${parentSlug ?? "root"}-${cleanName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
      name: cleanName,
      children: [],
    };

    if (!parentSlug) {
      return [...items, node];
    }

    return items.map((item) => {
      if (item.slug === parentSlug) {
        return { ...item, children: [...(item.children ?? []), node] };
      }
      if (item.children?.length) {
        return {
          ...item,
          children: appendSubcategoryToTree(item.children, parentSlug, cleanName),
        };
      }
      return item;
    });
  };

  const updateSubcategoryInTree = (
    items: SubcategoryNode[] = [],
    targetSlug: string,
    nextName: string,
  ): SubcategoryNode[] =>
    items.map((item) => {
      if (item.slug === targetSlug) {
        return { ...item, name: nextName };
      }
      if (item.children?.length) {
        return { ...item, children: updateSubcategoryInTree(item.children, targetSlug, nextName) };
      }
      return item;
    });

  const removeSubcategoryFromTree = (items: SubcategoryNode[] = [], targetSlug: string): SubcategoryNode[] =>
    items
      .filter((item) => item.slug !== targetSlug)
      .map((item) => ({
        ...item,
        children: item.children ? removeSubcategoryFromTree(item.children, targetSlug) : [],
      }));

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    const next = [
      ...categories,
      {
        id: `${Date.now()}-${trimmed}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
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

  const addSubcategory = (categoryId: string, parentSlug: string | null = null) => {
    const name = newSubcategoryName.trim();
    if (!name) return;

    const next = categories.map((category) => {
      if (category.id !== categoryId) return category;
      const nextChildren = appendSubcategoryToTree(
        (category.subcategories ?? []) as SubcategoryNode[],
        parentSlug,
        name,
      );
      return { ...category, subcategories: nextChildren };
    });

    persistCategories(next);
    setNewSubcategoryName("");
    setEditingSubcategoryKey(null);
  };

  const removeSubcategory = (categoryId: string, subcategorySlug: string) => {
    persistCategories(
      categories.map((category) => {
        if (category.id !== categoryId) return category;
        return {
          ...category,
          subcategories: removeSubcategoryFromTree(
            (category.subcategories ?? []) as SubcategoryNode[],
            subcategorySlug,
          ),
        };
      }),
    );
  };

  const saveSubcategory = (categoryId: string, subcategorySlug: string) => {
    const name = editingSubcategoryName.trim();
    if (!name) return;
    persistCategories(
      categories.map((category) => {
        if (category.id !== categoryId) return category;
        return {
          ...category,
          subcategories: updateSubcategoryInTree(
            (category.subcategories ?? []) as SubcategoryNode[],
            subcategorySlug,
            name,
          ),
        };
      }),
    );
    setEditingSubcategoryKey(null);
    setEditingSubcategoryName("");
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

  const selectedBrandName =
    brandList.find((brand) => brand.slug === selectedBrand)?.name ?? "Sin tienda seleccionada";
  const subcategoryDialogCategory = categories.find(
    (category) => category.id === subcategoryDialogCategoryId,
  );

  const renderSubcategoryNode = (
    node: SubcategoryNode,
    categoryId: string,
    depth = 0,
  ): JSX.Element => {
    const currentKey = `${categoryId}|${node.slug}`;
    const isEditing = editingSubcategoryKey === currentKey;

    return (
      <div key={node.slug} className="space-y-2">
        <div
          className="flex items-center gap-2 rounded-xl border border-input p-3"
          style={{ marginLeft: depth * 14 }}
        >
          {isEditing ? (
            <>
              <Input
                value={editingSubcategoryName}
                onChange={(event) => setEditingSubcategoryName(event.target.value)}
                className="h-8 min-w-0 flex-1 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!editingSubcategoryName.trim()}
                onClick={() => saveSubcategory(categoryId, node.slug)}
                className="h-8 gap-1 px-2 text-sm text-green-600 hover:bg-green-100/80 hover:text-green-700"
              >
                <Check className="size-4" /> Guardar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingSubcategoryKey(null);
                  setEditingSubcategoryName("");
                }}
                className="h-8 gap-1 px-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <X className="size-4" /> Cancelar
              </Button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-sm font-medium">{node.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingSubcategoryKey(currentKey);
                  setEditingSubcategoryName(node.name);
                }}
                className="h-8 gap-1 px-2 text-sm"
              >
                <Pencil className="size-4" /> Editar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addSubcategory(categoryId, node.slug)}
                className="h-8 gap-1 px-2 text-sm"
              >
                <Plus className="size-4" /> Subcat.
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSubcategory(categoryId, node.slug)}
                className="h-8 gap-1 px-2 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" /> Eliminar
              </Button>
            </>
          )}
        </div>
        {node.children?.length ? (
          <div className="space-y-2">
            {node.children.map((child) => renderSubcategoryNode(child, categoryId, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

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
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Ajustes del panel</p>
          <h1 className="mt-2 text-3xl font-semibold">Configuración</h1>
        </div>
      </div>

      <section className="mt-10 rounded-3xl border border-border/60 bg-surface/90 p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Store className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Tiendas disponibles</h2>
            <p className="text-sm text-muted-foreground">Seleccionar tienda a configurar.</p>
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

      <div className="mt-10 grid gap-6 lg:grid-cols-1">
        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Métodos de envíos</h2>
              <p className="text-sm text-muted-foreground">
                Configurar los métodos de envíos disponibles en{" "}
                {getBrand(selectedBrand)?.name ?? "esta tienda"}.
              </p>{" "}
            </div>
          </div>

          <div className="mt-6">
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
                  <Switch
                    checked={applyFreeShippingToAll}
                    onCheckedChange={setApplyFreeShippingToAll}
                  />
                </label>
                <Button
                  size="sm"
                  onClick={confirmFreeShippingThreshold}
                  disabled={
                    pendingFreeShippingThreshold.trim().length === 0 ||
                    Number.isNaN(Number(pendingFreeShippingThreshold))
                  }
                  className="h-9 shrink-0 gap-2"
                >
                  <Check className="h-4 w-4" />
                  Confirmar
                </Button>
              </div>
              <div className="flex w-fit max-w-full items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Hay envío gratis desde:
                </p>
                <p className="text-lg font-semibold text-foreground">${freeShippingThreshold}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-6">
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
                  <Switch
                    checked={applyShippingMethodsToAll}
                    onCheckedChange={setApplyShippingMethodsToAll}
                  />
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
                          disabled={
                            !editingMethodName.trim() || editingMethodName.trim() === method.name
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
                            <span className="text-sm">
                              {method.enabled ? "Disponible" : "No disponible"}
                            </span>
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
          </div>
        </section>

        <Dialog
          open={subcategoryDialogCategoryId !== null}
          onOpenChange={(open) => {
            if (!open) setSubcategoryDialogCategoryId(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Subcategorías
                {subcategoryDialogCategory ? ` de ${subcategoryDialogCategory.name}` : ""}
              </DialogTitle>
              <DialogDescription>
                Agregá y administrá las subcategorías de esta categoría.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {subcategoryDialogCategory?.subcategories?.map((subcategory) =>
                renderSubcategoryNode(subcategory as SubcategoryNode, subcategoryDialogCategory.id),
              )}
              {!subcategoryDialogCategory?.subcategories?.length && (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  Todavía no hay subcategorías.
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Input
                  value={newSubcategoryName}
                  onChange={(event) => setNewSubcategoryName(event.target.value)}
                  placeholder="Nueva subcategoría"
                  className="h-9"
                />
                <Button
                  type="button"
                  onClick={() =>
                    subcategoryDialogCategoryId && addSubcategory(subcategoryDialogCategoryId, null)
                  }
                  disabled={!newSubcategoryName.trim()}
                  className="h-9 shrink-0 gap-2"
                >
                  <Plus className="size-4" /> Agregar
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSubcategoryDialogCategoryId(null)}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <CreditCard className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Métodos de pago</h2>
              <p className="text-sm text-muted-foreground">
                Configurar los métodos de pagos disponibles en{" "}
                {getBrand(selectedBrand)?.name ?? "esta tienda"}.
              </p>
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
                <Switch
                  checked={applyPaymentMethodsToAll}
                  onCheckedChange={setApplyPaymentMethodsToAll}
                />
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
                          disabled={
                            !editingPaymentMethodName.trim() ||
                            editingPaymentMethodName.trim() === method.name
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
                          <span className="text-sm">
                            {method.enabled ? "Disponible" : "No disponible"}
                          </span>
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
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Landmark className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Transferencia bancaria</h2>
              <p className="text-sm text-muted-foreground">
                Agregar CBU para recibir transferencias en{" "}
                {getBrand(selectedBrand)?.name ?? "esta tienda"}.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-[70%] sm:max-w-107.5">
              <Input
                id="bank-cbu"
                value={bankCbu}
                onChange={(event) => setBankCbu(event.target.value)}
                placeholder="Escribir CBU para pagos en transferencia bancaria"
                aria-label="CBU para pagos en transferencia bancaria"
                inputMode="numeric"
                className="h-9"
              />
            </div>
            <label className="inline-flex h-9 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
              <span className="text-sm">Aplicar a todas las tiendas</span>
              <Switch checked={applyBankCbuToAll} onCheckedChange={setApplyBankCbuToAll} />
            </label>
            <Button
              type="button"
              size="sm"
              onClick={saveBankCbu}
              disabled={!bankCbu.trim()}
              className="h-9 shrink-0 gap-2"
            >
              <Check className="size-4" /> Guardar
            </Button>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Tags className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Categorías</h2>
              <p className="text-sm text-muted-foreground">
                Configurar las categorías y subcategorías en{" "}
                {getBrand(selectedBrand)?.name ?? "esta tienda"}.
              </p>
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
              <Button
                onClick={addCategory}
                size="sm"
                disabled={!newCategory.trim()}
                className="h-9 shrink-0 gap-2"
              >
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
                      <div className="space-y-3">
                        <div>{category.name}</div>
                        {(category.subcategories ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(category.subcategories ?? []).map((subcategory) => (
                              <span
                                key={subcategory.slug}
                                className="rounded-md bg-primary/10 px-2 py-1 text-xs font-normal text-primary"
                              >
                                {subcategory.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingCategoryId !== category.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSubcategoryDialogCategoryId(category.id);
                          setNewSubcategoryName("");
                        }}
                        className="h-8 gap-1 px-2 text-xs"
                      >
                        <Plus className="size-3" /> Subcategorías
                      </Button>
                    )}
                    {editingCategoryId === category.id ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveEditedCategory(category.id)}
                          disabled={
                            !editingCategoryName.trim() ||
                            (editingCategoryName.trim() === category.name &&
                              editingCategorySubtitle.trim() ===
                                (category.description ?? "").trim())
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
                          <span className="text-sm">
                            {category.enabled ? "Disponible" : "No disponible"}
                          </span>
                          <Switch
                            checked={category.enabled}
                            onCheckedChange={() => toggleCategory(category.id)}
                          />
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

        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <BadgePercent className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Descuentos</h2>
              <p className="text-sm text-muted-foreground">
                Agregar códigos de descuento propios en{" "}
                {getBrand(selectedBrand)?.name ?? "esta tienda"}.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full space-y-2 sm:w-[70%] sm:max-w-107.5">
              <Input
                id="newDiscountCode"
                value={newDiscountCode}
                onChange={(event) => setNewDiscountCode(event.target.value)}
                placeholder="Escribir código de descuento"
                autoComplete="off"
                className="h-9"
              />
            </div>
            <div className="w-full space-y-3 sm:w-32">
              <Label htmlFor="newDiscountPercentage">Porcentaje (%)</Label>
              <Input
                id="newDiscountPercentage"
                type="number"
                min={1}
                max={100}
                value={newDiscountPercentage}
                onChange={(event) => setNewDiscountPercentage(Number(event.target.value))}
              />
            </div>
            <Button
              onClick={addDiscount}
              size="sm"
              disabled={!newDiscountCode.trim() || newDiscountPercentage < 1}
              className="h-9 shrink-0 gap-2"
            >
              <Plus className="size-4" /> Agregar
            </Button>
          </div>

          <div className="mt-5 grid gap-2">
            {discounts.map((discount) => (
              <div
                key={discount.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/80 p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{discount.code}</span>
                  <span className="text-sm text-muted-foreground">
                    {discount.percentage}% de descuento
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                    <span className="text-sm">{discount.enabled ? "Activo" : "Inactivo"}</span>
                    <Switch
                      checked={discount.enabled}
                      onCheckedChange={() => toggleDiscount(discount.id)}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-destructive hover:bg-destructive/10"
                    onClick={() => removeDiscount(discount.id)}
                  >
                    <Trash2 className="size-4" /> Eliminar
                  </Button>
                </div>
              </div>
            ))}
            {discounts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay descuentos configurados para esta tienda.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
