import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/common/brand-mark";
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
import {
  brandList,
  getStoreShopContact,
  getBrandContactPresentation,
  setBrandContactPresentation,
  setStoreShopContact,
  storeShopListing,
  type StoreShopContactItem,
  type BrandContactPresentation,
} from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { catalogQueries } from "@/services/catalog.service";

export const Route = createFileRoute("/admin/marcas")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueries.all()),
  head: () => ({
    meta: [
      { title: "LRG Store Shop - Administrador" },
      {
        name: "description",
        content: "Configuración de los tres sectores: identidad, categorías, contacto y pagos.",
      },
      { property: "og:title", content: "LRG Store Shop - Administrador" },
      { property: "og:description", content: "Configuración de sectores del negocio LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBrands,
});

function AdminBrands() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const [storeContact, setStoreContact] = useState(getStoreShopContact);
  const [editingStoreField, setEditingStoreField] = useState<string | null>(null);
  const [storeDraft, setStoreDraft] = useState<StoreShopContactItem | null>(null);
  const [editingFieldLabel, setEditingFieldLabel] = useState<string | null>(null);
  const [brandPresentations, setBrandPresentations] = useState<
    Record<string, BrandContactPresentation>
  >(() =>
    Object.fromEntries(
      brandList.map((brand) => [brand.slug, getBrandContactPresentation(brand.slug)]),
    ),
  );
  const [editingBrandPresentation, setEditingBrandPresentation] = useState<string | null>(null);
  const [brandPresentationDraft, setBrandPresentationDraft] = useState<StoreShopContactItem | null>(
    null,
  );

  const closeEditor = () => {
    setEditingStoreField(null);
    setEditingBrandPresentation(null);
    setStoreDraft(null);
    setBrandPresentationDraft(null);
    setEditingFieldLabel(null);
  };

  const startEditingStoreField = (key: string, label: string, item: StoreShopContactItem) => {
    setEditingStoreField(key);
    setStoreDraft({ ...item });
    setEditingFieldLabel(label);
  };

  const hasContactItemChanges = (draft: StoreShopContactItem, original: StoreShopContactItem) =>
    draft.text !== original.text || draft.href !== original.href || draft.logo !== original.logo;

  const saveEditingStoreField = () => {
    if (!editingStoreField || !storeDraft || !storeDraft.text.trim()) return;
    const [group, key] = editingStoreField.split(".") as [
      "contact" | "socials",
      (
        | "email"
        | "phone"
        | "location"
        | "instagram"
        | "whatsapp"
        | "tiktok"
        | "facebook"
        | "trustpilot"
        | "google"
      ),
    ];
    const next =
      group === "contact"
        ? setStoreShopContact({ [key]: { ...storeDraft, text: storeDraft.text.trim() } })
        : setStoreShopContact({
            socials: { [key]: { ...storeDraft, text: storeDraft.text.trim() } },
          });
    setStoreContact(next);
    closeEditor();
  };

  const startEditingBrandPresentation = (
    key: string,
    label: string,
    item: StoreShopContactItem,
  ) => {
    setEditingBrandPresentation(key);
    setBrandPresentationDraft({ ...item });
    setEditingFieldLabel(label);
  };

  const saveEditingBrandPresentation = () => {
    if (!editingBrandPresentation || !brandPresentationDraft) return;
    const [slug, group, key] = editingBrandPresentation.split(".") as [
      "arcade" | "scents" | "web-design",
      "contact" | "socials",
      keyof StoreShopContact | keyof StoreShopContact["socials"],
    ];
    const next =
      group === "contact"
        ? setBrandContactPresentation(slug, { [key]: brandPresentationDraft })
        : setBrandContactPresentation(slug, { socials: { [key]: brandPresentationDraft } });
    setBrandPresentations((current) => ({ ...current, [slug]: next }));
    closeEditor();
  };

  const storeContactFields = [
    { key: "contact.email", label: "Correo", item: storeContact.email },
    { key: "contact.phone", label: "Celular", item: storeContact.phone },
    { key: "contact.location", label: "Ubicación", item: storeContact.location },
    { key: "socials.instagram", label: "Instagram", item: storeContact.socials.instagram },
    { key: "socials.whatsapp", label: "WhatsApp", item: storeContact.socials.whatsapp },
    { key: "socials.tiktok", label: "TikTok", item: storeContact.socials.tiktok },
    { key: "socials.facebook", label: "Facebook", item: storeContact.socials.facebook },
    { key: "socials.trustpilot", label: "Trustpilot", item: storeContact.socials.trustpilot },
    { key: "socials.google", label: "Google", item: storeContact.socials.google },
  ];

  const activeDraft = storeDraft ?? brandPresentationDraft;
  const activeOriginal = editingStoreField
    ? storeContactFields.find((field) => field.key === editingStoreField)?.item
    : editingBrandPresentation
      ? (() => {
          const [slug, group, key] = editingBrandPresentation.split(".") as [
            keyof typeof brandPresentations,
            "contact" | "socials",
            string,
          ];
          return group === "contact"
            ? brandPresentations[slug][key as keyof BrandContactPresentation]
            : brandPresentations[slug].socials[key as keyof BrandContactPresentation["socials"]];
        })()
      : null;
  const hasActiveChanges =
    activeDraft && activeOriginal ? hasContactItemChanges(activeDraft, activeOriginal) : false;

  const updateActiveDraft = (updates: Partial<StoreShopContactItem>) => {
    if (editingStoreField) {
      setStoreDraft((current) => (current ? { ...current, ...updates } : current));
    } else {
      setBrandPresentationDraft((current) => (current ? { ...current, ...updates } : current));
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const syncFromStorage = () => {
        setStoreContact(getStoreShopContact());
        setBrandPresentations(
          Object.fromEntries(
            brandList.map((brand) => [brand.slug, getBrandContactPresentation(brand.slug)]),
          ),
        );
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
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Sectores</p>
      <h1 className="mt-2 text-3xl font-semibold">Tiendas disponibles</h1>

      <div className="mt-10 grid grid-cols-1 items-stretch gap-4 pb-20 sm:grid-cols-2">
        <article className="theme-webdesign glass-panel flex min-w-0 h-full flex-col justify-between rounded-2xl p-3">
          <div>
            <div className="flex items-start gap-3">
              <BrandMark compact brandSlug="store-shop" />
              <div className="min-h-14">
                <h2 className="font-display font-semibold">{storeShopListing.name}</h2>
                <p className="text-xs text-primary">
                  Productos gaming, streaming, perfumería árabe y diseño de páginas web
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
              {storeContactFields.map((field) => {
                return (
                  <div key={field.key} className="flex items-center justify-between gap-2">
                    <p className="truncate">{field.label}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditingStoreField(field.key, field.label, field.item)}
                      className="h-8 shrink-0 gap-1 px-2 text-white hover:text-white"
                    >
                      <Pencil className="size-4 text-white" />{" "}
                      <span className="text-[11px] text-white">Editar</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <Button asChild variant="secondary" size="sm" className="mt-6 w-full gap-2">
            <Link to="/">
              Ir a la tienda <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </article>

        {brandList.map((brand) => {
          const brandProducts = products.filter((product) => product.brand === brand.slug);
          const inventoryValue = brandProducts.reduce(
            (sum, product) => sum + product.price * product.stock,
            0,
          );

          return (
            <article
              key={brand.slug}
              className={`${brand.theme} glass-panel flex min-w-0 h-full flex-col justify-between rounded-2xl p-3`}
            >
              <div>
                <div className="flex items-start gap-3">
                  <BrandMark compact brandSlug={brand.slug} />
                  <div className="min-h-14">
                    <h2 className="font-display font-semibold">{brand.name}</h2>
                    <p className="text-xs text-primary">{brand.tagline}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  {(
                    [
                      {
                        key: "contact.email",
                        label: "Correo",
                        item: brandPresentations[brand.slug].email,
                      },
                      {
                        key: "contact.phone",
                        label: "Celular",
                        item: brandPresentations[brand.slug].phone,
                      },
                      {
                        key: "contact.location",
                        label: "Ubicación",
                        item: brandPresentations[brand.slug].location,
                      },
                      {
                        key: "socials.instagram",
                        label: "Instagram",
                        item: brandPresentations[brand.slug].socials.instagram,
                      },
                      {
                        key: "socials.whatsapp",
                        label: "WhatsApp",
                        item: brandPresentations[brand.slug].socials.whatsapp,
                      },
                      {
                        key: "socials.tiktok",
                        label: "TikTok",
                        item: brandPresentations[brand.slug].socials.tiktok,
                      },
                      {
                        key: "socials.facebook",
                        label: "Facebook",
                        item: brandPresentations[brand.slug].socials.facebook,
                      },
                      {
                        key: "socials.trustpilot",
                        label: "Trustpilot",
                        item: brandPresentations[brand.slug].socials.trustpilot,
                      },
                      {
                        key: "socials.google",
                        label: "Google",
                        item: brandPresentations[brand.slug].socials.google,
                      },
                    ] as const
                  ).map((field) => {
                    return (
                      <div key={field.key} className="flex items-center justify-between gap-2">
                        <p className="truncate">{field.label}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            startEditingBrandPresentation(
                              `${brand.slug}.${field.key}`,
                              field.label,
                              field.item,
                            )
                          }
                          className="h-8 shrink-0 gap-1 px-2 text-white hover:text-white"
                        >
                          <Pencil className="size-4 text-white" /> Editar
                        </Button>
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

      <Dialog
        open={Boolean(activeDraft && editingFieldLabel)}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editingFieldLabel}</DialogTitle>
            <DialogDescription>
              Actualiza la información de contacto de esta tienda.
            </DialogDescription>
          </DialogHeader>
          {activeDraft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="contact-text">
                  Texto a mostrar
                </label>
                <Input
                  id="contact-text"
                  value={activeDraft.text}
                  onChange={(event) => updateActiveDraft({ text: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="contact-link">
                  Link
                </label>
                <Input
                  id="contact-link"
                  value={activeDraft.href}
                  onChange={(event) => updateActiveDraft({ href: event.target.value })}
                />
              </div>
              <label className="space-y-2">
                <span className="block text-sm font-medium">Adjuntar logo</span>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => updateActiveDraft({ logo: String(reader.result ?? "") });
                    reader.readAsDataURL(file);
                  }}
                  className="h-9 cursor-pointer file:mr-3 file:border-0 file:bg-transparent file:text-xs"
                />
                {activeDraft.logo && (
                  <img
                    src={activeDraft.logo}
                    alt="Vista previa del logo"
                    className="size-10 rounded object-contain"
                  />
                )}
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeEditor}>
              Cancelar
            </Button>
            <Button
              onClick={editingStoreField ? saveEditingStoreField : saveEditingBrandPresentation}
              disabled={!activeDraft?.text.trim() || !hasActiveChanges}
              className="gap-1"
            >
              <Check className="size-4" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
