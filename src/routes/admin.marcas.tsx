import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brandList, setBrandContact } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { catalogQueries } from "@/services/catalog.service";

export const Route = createFileRoute("/admin/marcas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueries.all()),
  head: () => ({
    meta: [
      { title: "Marcas — Admin LRG Store Shop" },
      {
        name: "description",
        content: "Configuración de los tres sectores: identidad, categorías, contacto y pagos.",
      },
      { property: "og:title", content: "Marcas — Admin LRG Store Shop" },
      { property: "og:description", content: "Configuración de marcas del ecosistema LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBrands,
});

function AdminBrands() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const [contactData, setContactData] = useState<Record<string, { email: string; phone: string; location: string }>>(() => {
    if (typeof window === "undefined") {
      return Object.fromEntries(
        brandList.map((brand) => [brand.slug, { ...brand.contact }]),
      ) as Record<string, { email: string; phone: string; location: string }>;
    }

    try {
      const raw = window.localStorage.getItem("lrg-brand-contact-v1");
      if (!raw) {
        return Object.fromEntries(
          brandList.map((brand) => [brand.slug, { ...brand.contact }]),
        ) as Record<string, { email: string; phone: string; location: string }>;
      }

      const parsed = JSON.parse(raw) as Record<string, { email: string; phone: string; location: string }>;
      return Object.fromEntries(
        brandList.map((brand) => [brand.slug, { ...brand.contact, ...(parsed[brand.slug] ?? {}) }]),
      ) as Record<string, { email: string; phone: string; location: string }>;
    } catch {
      return Object.fromEntries(
        brandList.map((brand) => [brand.slug, { ...brand.contact }]),
      ) as Record<string, { email: string; phone: string; location: string }>;
    }
  });
  const [editingField, setEditingField] = useState<{
    brandSlug: string;
    field: "email" | "phone" | "location";
  } | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const startEditingField = (brandSlug: string, field: "email" | "phone" | "location") => {
    const currentValue = contactData[brandSlug]?.[field] ?? "";
    setEditingField({ brandSlug, field });
    setDraftValue(currentValue);
  };

  const saveEditedField = (brandSlug: string, field: "email" | "phone" | "location") => {
    const trimmed = draftValue.trim();
    if (!trimmed) return;

    const next = {
      ...contactData,
      [brandSlug]: {
        ...contactData[brandSlug],
        [field]: trimmed,
      },
    };

    setContactData(next);
    setBrandContact(brandSlug as any, { [field]: trimmed });
    setEditingField(null);
    setDraftValue("");
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const syncFromStorage = () => {
        try {
          const raw = window.localStorage.getItem("lrg-brand-contact-v1");
          if (!raw) {
            setContactData(Object.fromEntries(
              brandList.map((brand) => [brand.slug, { ...brand.contact }]),
            ) as Record<string, { email: string; phone: string; location: string }>);
            return;
          }

          const parsed = JSON.parse(raw) as Record<string, { email: string; phone: string; location: string }>;
          setContactData(Object.fromEntries(
            brandList.map((brand) => [brand.slug, { ...brand.contact, ...(parsed[brand.slug] ?? {}) }]),
          ) as Record<string, { email: string; phone: string; location: string }>);
        } catch {
          setContactData(Object.fromEntries(
            brandList.map((brand) => [brand.slug, { ...brand.contact }]),
          ) as Record<string, { email: string; phone: string; location: string }>);
        }
      };

      syncFromStorage();
      window.addEventListener("lrg-brand-data-updated", syncFromStorage);
      return () => {
        window.removeEventListener("lrg-brand-data-updated", syncFromStorage);
      };
    }
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Ecosistema</p>
      <h1 className="mt-2 text-3xl font-semibold">Tiendas disponibles</h1>

      <div className="mt-10 grid gap-6 pb-20 lg:grid-cols-3">
        {brandList.map((brand) => {
          const brandProducts = products.filter((product) => product.brand === brand.slug);
          const inventoryValue = brandProducts.reduce(
            (sum, product) => sum + product.price * product.stock,
            0,
          );

          return (
            <article key={brand.slug} className={`${brand.theme} glass-panel rounded-2xl p-6 h-full flex flex-col justify-between`}>
              <div>
                <div className="flex items-start gap-3">
                  <BrandMark compact brandSlug={brand.slug} />
                  <div className="min-h-14">
                    <h2 className="font-display font-semibold">{brand.name}</h2>
                    <p className="text-xs text-primary">{brand.tagline}</p>
                  </div>
                </div>

              <div className="mt-5">
                <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                  Categorías
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {brand.categories.map((category) => (
                    <Badge key={category.slug} variant="secondary">
                      {category.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-2 text-xs text-muted-foreground">
                {([
                  { key: "email", label: "Correo", value: contactData[brand.slug]?.email ?? brand.contact.email },
                  { key: "phone", label: "Celular", value: contactData[brand.slug]?.phone ?? brand.contact.phone },
                  { key: "location", label: "Ubicación", value: contactData[brand.slug]?.location ?? brand.contact.location },
                ] as const).map((field) => {
                  const isEditing =
                    editingField?.brandSlug === brand.slug && editingField.field === field.key;

                  return (
                    <div key={field.key} className="flex items-center justify-between gap-2">
                      {isEditing ? (
                        <div className="flex w-full items-center gap-2">
                              <Input
                                value={draftValue}
                                onChange={(event) => setDraftValue(event.target.value)}
                                className="h-8 min-w-0 flex-1"
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => saveEditedField(brand.slug, field.key)}
                                className="h-8 shrink-0 gap-1 px-2"
                                disabled={!draftValue.trim()}
                              >
                                <Check className="h-4 w-4" />
                                <span className="text-[11px]">Guardar</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingField(null);
                                  setDraftValue("");
                                }}
                                className="h-8 shrink-0 gap-1 px-2 text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                                <span className="text-[11px]">Cancelar</span>
                              </Button>
                        </div>
                      ) : (
                        <>
                          <p className="flex-1 truncate">{field.value}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditingField(brand.slug, field.key)}
                            className="h-8 shrink-0 gap-1 px-2"
                            aria-label={`Editar ${field.label}`}
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="text-[11px]">Editar</span>
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

              <Button asChild variant="secondary" size="sm" className="mt-6 w-full gap-2">
                <Link to="/$brand" params={{ brand: brand.slug }}>
                  Ir a la tienda <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
