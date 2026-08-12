import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Pencil, Settings, Store, Trash2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { brandList, setBrandCategories } from "@/config/brands";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/configuracion")({
  head: () => ({
    meta: [
      { title: "Configuración — Admin LRG Store Shop" },
      { name: "description", content: "Ajustes generales del admin: categorías, envíos y más." },
      { property: "og:title", content: "Configuración — Admin LRG Store Shop" },
      { property: "og:description", content: "Administrá categorías, envíos y ajustes del ecosistema." },
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
  const [newShippingMethod, setNewShippingMethod] = useState("");
  const [shippingMethods, setShippingMethods] = useState([
    { id: "physical", name: "Físico", enabled: true },
    { id: "digital", name: "Digital", enabled: true },
    { id: "whatsapp", name: "WhatsApp", enabled: true },
  ]);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);
  const [editingMethodName, setEditingMethodName] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");
  const [paymentMethods, setPaymentMethods] = useState([
    { id: "transferencia-bancaria", name: "Transferencia bancaria", enabled: true },
    { id: "tarjeta-credito", name: "Tarjeta de crédito", enabled: true },
    { id: "tarjeta-debito", name: "Tarjeta de débito", enabled: true },
    { id: "efectivo", name: "Efectivo", enabled: true },
    { id: "mercadopago", name: "MercadoPago", enabled: true },
  ]);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const [editingPaymentMethodName, setEditingPaymentMethodName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState(brandList[0]?.slug ?? "");
  const [categories, setCategories] = useState(() => {
    const current = brandList.find((brand) => brand.slug === selectedBrand)?.categories ?? [];
    return current.map((category) => ({ id: category.slug, name: category.name, enabled: true }));
  });

  useEffect(() => {
    syncCategoriesToSelectedBrand(selectedBrand);
  }, [selectedBrand]);

  useEffect(() => {
    try {
      const storedShippingMethods = localStorage.getItem("lrg:shippingMethods");
      if (storedShippingMethods) {
        const parsed = JSON.parse(storedShippingMethods);
        if (Array.isArray(parsed)) {
          setShippingMethods(parsed.map((item: any) => ({
            id: item.id ?? `${Date.now()}-${item.name}`,
            name: String(item.name ?? item),
            enabled: item.enabled !== false,
          })));
        }
      }
    } catch {
      // ignore invalid storage
    }

    try {
      const storedPaymentMethods = localStorage.getItem("lrg:paymentMethods");
      if (storedPaymentMethods) {
        const parsed = JSON.parse(storedPaymentMethods);
        if (Array.isArray(parsed)) {
          setPaymentMethods(parsed.map((item: any) => ({
            id: item.id ?? `${Date.now()}-${item.name}`,
            name: String(item.name ?? item),
            enabled: item.enabled !== false,
          })));
        }
      }
    } catch {
      // ignore invalid storage
    }
  }, []);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const persistCategories = (nextCategories: typeof categories) => {
    const selectedBrandConfig = brandList.find((brand) => brand.slug === selectedBrand);
    if (!selectedBrandConfig) return;

    const updatedCategories = nextCategories.map((category) => ({
      slug: category.id || category.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      name: category.name.trim(),
      description: category.name.trim(),
    }));

    setBrandCategories(selectedBrandConfig.slug, updatedCategories);
    setCategories(nextCategories);
  };

  const syncCategoriesToSelectedBrand = (brandSlug: string) => {
    const current = brandList.find((brand) => brand.slug === brandSlug)?.categories ?? [];
    setCategories(current.map((category) => ({ id: category.slug, name: category.name, enabled: true })));
  };

  const addShippingMethod = () => {
    const trimmed = newShippingMethod.trim();
    if (!trimmed) return;
    setShippingMethods((current) => [
      ...current,
      { id: `${Date.now()}-${trimmed}`, name: trimmed, enabled: true },
    ]);
    setNewShippingMethod("");
  };

  const confirmFreeShippingThreshold = () => {
    const trimmed = pendingFreeShippingThreshold.trim();
    const parsed = Number(trimmed);
    if (!trimmed || Number.isNaN(parsed) || parsed < 0) return;
    setFreeShippingConfirmationStatus(parsed === freeShippingThreshold ? "unchanged" : "confirmed");
    setFreeShippingThreshold(parsed);
    setFreeShippingConfirmed(true);

    toast.success("Envío gratis confirmado", {
      description: `Desde $${parsed}`,
    });
  };

  const toggleShippingMethod = (id: string) => {
    setShippingMethods((current) =>
      current.map((method) =>
        method.id === id ? { ...method, enabled: !method.enabled } : method,
      ),
    );
  };

  const startEditingMethod = (method: { id: string; name: string }) => {
    setEditingMethodId(method.id);
    setEditingMethodName(method.name);
  };

  const saveEditedMethod = (id: string) => {
    const trimmed = editingMethodName.trim();
    if (!trimmed) return;
    setShippingMethods((current) =>
      current.map((method) =>
        method.id === id ? { ...method, name: trimmed } : method,
      ),
    );
    setEditingMethodId(null);
    setEditingMethodName("");
  };

  const removeShippingMethod = (id: string) => {
    setShippingMethods((current) => current.filter((method) => method.id !== id));
  };

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: undefined, onConfirm: () => {} });

  const togglePaymentMethod = (id: string) => {
    setPaymentMethods((current) =>
      current.map((method) =>
        method.id === id ? { ...method, enabled: !method.enabled } : method,
      ),
    );
  };

  const startEditingPaymentMethod = (method: { id: string; name: string }) => {
    setEditingPaymentMethodId(method.id);
    setEditingPaymentMethodName(method.name);
  };

  const saveEditedPaymentMethod = (id: string) => {
    const trimmed = editingPaymentMethodName.trim();
    if (!trimmed) return;
    setPaymentMethods((current) =>
      current.map((method) =>
        method.id === id ? { ...method, name: trimmed } : method,
      ),
    );
    setEditingPaymentMethodId(null);
    setEditingPaymentMethodName("");
  };

  const removePaymentMethod = (id: string) => {
    setPaymentMethods((current) => current.filter((method) => method.id !== id));
  };

  const addPaymentMethod = () => {
    const trimmed = newPaymentMethod.trim();
    if (!trimmed) return;
    setPaymentMethods((current) => [
      ...current,
      {
        id: `${Date.now()}-${trimmed}`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
        name: trimmed,
        enabled: true,
      },
    ]);
    setNewPaymentMethod("");
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    const next = [
      ...categories,
      { id: `${Date.now()}-${trimmed}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""), name: trimmed, enabled: true },
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

  const startEditingCategory = (category: { id: string; name: string }) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
  };

  const saveEditedCategory = (id: string) => {
    const trimmed = editingCategoryName.trim();
    if (!trimmed) return;
    const next = categories.map((category) =>
      category.id === id ? { ...category, name: trimmed } : category,
    );
    persistCategories(next);
    setEditingCategoryId(null);
    setEditingCategoryName("");
  };

  const removeCategory = (id: string) => {
    const next = categories.filter((category) => category.id !== id);
    persistCategories(next);
  };

  const handleBrandChange = (brandSlug: string) => {
    setSelectedBrand(brandSlug);
    syncCategoriesToSelectedBrand(brandSlug);
  };

  const selectedBrandName = brandList.find((brand) => brand.slug === selectedBrand)?.name ?? "Sin tienda seleccionada";

  useEffect(() => {
    try {
      localStorage.setItem("lrg:paymentMethods", JSON.stringify(paymentMethods));
    } catch (e) {
      // ignore
    }
  }, [paymentMethods]);

  useEffect(() => {
    try {
      localStorage.setItem("lrg:shippingMethods", JSON.stringify(shippingMethods));
    } catch (e) {
      // ignore
    }
  }, [shippingMethods]);

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
            <Settings className="size-5 text-primary" />
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
                  className="h-9 min-w-0 w-[28%] max-w-[170px]"
                />
                <Button
                  size="sm"
                  onClick={confirmFreeShippingThreshold}
                  disabled={pendingFreeShippingThreshold.trim().length === 0 || Number.isNaN(Number(pendingFreeShippingThreshold))}
                  className="h-9 flex-shrink-0 gap-2"
                >
                  <Check className="h-4 w-4" />
                  Confirmar
                </Button>
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
                  className="h-9 min-w-0 w-[70%] max-w-[430px]"
                />
                <Button
                  size="sm"
                  onClick={addShippingMethod}
                  disabled={!newShippingMethod.trim()}
                  className="h-9 flex-shrink-0 gap-2"
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
                        className="min-w-[140px]"
                      />
                    ) : (
                      method.name
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingMethodId === method.id ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => saveEditedMethod(method.id)}
                          disabled={!editingMethodName.trim()}
                          className="gap-2"
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
                          className="gap-2 text-destructive hover:bg-destructive/10"
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
                            onCheckedChange={() => toggleShippingMethod(method.id)}
                          />
                        </label>
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
              <Pencil className="size-5" />
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
                className="h-9 min-w-0 w-[70%] max-w-[430px]"
              />
              <Button
                size="sm"
                onClick={addPaymentMethod}
                disabled={!newPaymentMethod.trim()}
                className="h-9 flex-shrink-0 gap-2"
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
                        className="min-w-[140px] w-full"
                      />
                    ) : (
                      method.name
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingPaymentMethodId === method.id ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => saveEditedPaymentMethod(method.id)}
                          disabled={!editingPaymentMethodName.trim()}
                          className="gap-2"
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
                          className="gap-2 text-destructive hover:bg-destructive/10"
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
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Pencil className="size-5" />
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
                className="h-9 min-w-0 w-[70%] max-w-[430px]"
              />
              <Button onClick={addCategory} size="sm" disabled={!newCategory.trim()} className="h-9 flex-shrink-0 gap-2">
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
                      <Input
                        value={editingCategoryName}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                        className="min-w-[140px] w-full"
                      />
                    ) : (
                      category.name
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {editingCategoryId === category.id ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => saveEditedCategory(category.id)}
                          disabled={!editingCategoryName.trim()}
                          className="gap-2"
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
