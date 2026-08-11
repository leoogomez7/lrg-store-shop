import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Search, Trash2, X, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { products as productsData } from "@/data/products";
import { useEffect, useMemo, useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brandList, brands, type BrandSlug } from "@/config/brands";
import { formatPrice } from "@/lib/format";
import { catalogQueries, type Product } from "@/services/catalog.service";

type DeliveryUnit = "inmediata" | "horas" | "dias";

type ProductFormState = {
  id: string;
  name: string;
  brand: BrandSlug;
  category: string;
  price: number;
  stock: number;
  description: string;
  features: string[];
  images: string[];
  gastos: number;
  deliveryUnit: DeliveryUnit;
  deliveryAmount: number;
  discount: number;
};

export const Route = createFileRoute("/admin/productos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueries.all()),
  head: () => ({
    meta: [
      { title: "Productos — Admin LRG Store Shop" },
      {
        name: "description",
        content: "Administrá el catálogo completo: precios, stock y categorías por sector.",
      },
      { property: "og:title", content: "Productos — Admin LRG Store Shop" },
      { property: "og:description", content: "Gestión de catálogo del ecosistema LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminProducts,
});

function AdminProducts() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const [editableProducts, setEditableProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<BrandSlug | "todas">("todas");
  const [sortOrder, setSortOrder] = useState<SortOrder>("name_asc");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [pendingDiscounts, setPendingDiscounts] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [page, setPage] = useState(0);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: undefined, onConfirm: () => {} });

  useEffect(() => {
    setEditableProducts(products);
  }, [products]);

  const defaultFormState: ProductFormState = {
    id: "",
    name: "",
    brand: "arcade",
    category: "",
    price: 0,
    stock: 0,
    description: "",
    features: [],
    images: [],
    gastos: 0,
    deliveryUnit: "inmediata",
    deliveryAmount: 0,
    discount: 0,
  };

  const openNewProductDialog = () => {
    setEditingProduct(null);
    setProductForm(defaultFormState);
    setDialogOpen(true);
  };

  const openEditProductDialog = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      stock: product.stock,
      description: product.description,
      features: product.features ?? [],
      images: product.images ?? [],
      gastos: 0,
      deliveryUnit: "inmediata",
      deliveryAmount: 1,
      discount: discounts[product.id] ?? 0,
    });
    setPendingDiscounts((current) => ({
      ...current,
      [product.id]: String(discounts[product.id] ?? 0),
    }));
    setDialogOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    setEditableProducts((current) => current.filter((product) => product.id !== productId));
    setDiscounts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setPendingDiscounts((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
  };

  const handleDuplicateProduct = (product: Product) => {
    const newId = `${product.id}-copy-${Date.now()}`;
    const newSlug = `${product.slug}-copy-${Date.now()}`.replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-");
    const duplicated: Product = {
      ...product,
      id: newId,
      slug: newSlug,
      name: `${product.name} (Copia)`,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    // Add to in-memory dataset so public getters reflect it and update UI
    (productsData as Product[]).push(duplicated);
    setEditableProducts((current) => [...current, duplicated]);
  };

  const handleToggleHidden = (productId: string) => {
    // Toggle hidden flag on the shared products data so public listing respects it
    const idx = (productsData as Product[]).findIndex((p) => p.id === productId);
    if (idx === -1) return;
    const current = (productsData as Product[])[idx] as Product & { hidden?: boolean };
    current.hidden = !current.hidden;

    // Update local editable list to reflect the change
    setEditableProducts((currentList) => currentList.map((p) => (p.id === productId ? { ...p, hidden: current.hidden } : p)));
  };

  const handleApplyDiscount = (productId: string) => {
    const text = pendingDiscounts[productId] ?? String(discounts[productId] ?? 0);
    const nextDiscount = Math.max(0, Math.min(100, Number(text) || 0));

    setDiscounts((current) => ({
      ...current,
      [productId]: nextDiscount,
    }));
    setPendingDiscounts((current) => ({
      ...current,
      [productId]: String(nextDiscount),
    }));
    const appliedProduct = products.find((p) => p.id === productId);
    toast.success("Descuento aplicado", {
      description: `${nextDiscount}% aplicado a "${appliedProduct?.name ?? productId}"`,
    });
  };

  type SortOrder =
    | "name_asc"
    | "name_desc"
    | "price_asc"
    | "price_desc"
    | "stock_asc"
    | "stock_desc"
    | "discountedPrice_asc"
    | "discountedPrice_desc";

  const handleSaveProduct = () => {
    if (!productForm) return;

    let savedProductId = productForm.id;

    setEditableProducts((current) => {
      const updated = current.map((item) =>
        item.id === productForm.id
          ? {
              ...item,
              name: productForm.name,
              brand: productForm.brand,
              category: productForm.category,
              price: productForm.price,
              stock: productForm.stock,
              description: productForm.description,
              features: productForm.features,
              images: productForm.images,
            }
          : item,
      );

      if (!editingProduct) {
        savedProductId = `new-${Date.now()}`;
        return [
          ...current,
          {
            id: savedProductId,
            slug: productForm.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, ""),
            brand: productForm.brand,
            name: productForm.name,
            category: productForm.category,
            price: productForm.price,
            stock: productForm.stock,
            rating: 0,
            reviews: 0,
            short: productForm.description,
            description: productForm.description,
            features: productForm.features,
            images: productForm.images,
            createdAt: new Date().toISOString().slice(0, 10),
          },
        ];
      }

      return updated;
    });

    if (savedProductId) {
      setDiscounts((current) => ({
        ...current,
        [savedProductId]: productForm.discount,
      }));
    }

    setDialogOpen(false);
  };

  const results = useMemo(() => {
    const filtered = editableProducts.filter((product) => {
      if (brandFilter !== "todas" && product.brand !== brandFilter) return false;
      if (query && !product.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      const aDiscount = discounts[a.id] ?? 0;
      const bDiscount = discounts[b.id] ?? 0;
      const aDiscountedPrice = a.price * (1 - aDiscount / 100);
      const bDiscountedPrice = b.price * (1 - bDiscount / 100);

      switch (sortOrder) {
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "stock_asc":
          return a.stock - b.stock;
        case "stock_desc":
          return b.stock - a.stock;
        case "discountedPrice_asc":
          return aDiscountedPrice - bDiscountedPrice;
        case "discountedPrice_desc":
          return bDiscountedPrice - aDiscountedPrice;
        default:
          return 0;
      }
    });
  }, [editableProducts, query, brandFilter, sortOrder, discounts]);

  useEffect(() => {
    setPage(0);
  }, [results]);

  const visibleResults = useMemo(() => results.slice(page * 10, page * 10 + 10), [results, page]);
  const totalPages = Math.max(1, Math.ceil(results.length / 10));
  const hasNextPage = page + 1 < totalPages;
  const hasPreviousPage = page > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
          <h1 className="mt-2 text-3xl font-semibold">Productos</h1>
        </div>
        <Button className="gap-2" onClick={openNewProductDialog}>
          <Plus className="size-4" /> Nuevo producto
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto"
            className="pl-9"
          />
        </div>
        <Select
          value={brandFilter}
          onValueChange={(value) => setBrandFilter(value as BrandSlug | "todas")}
        >
          <SelectTrigger className="w-50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Tiendas</SelectItem>
            {brandList.map((brand) => (
              <SelectItem key={brand.slug} value={brand.slug}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Ordenar por" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Producto A-Z</SelectItem>
            <SelectItem value="name_desc">Producto Z-A</SelectItem>
            <SelectItem value="price_asc">Precio menor a mayor</SelectItem>
            <SelectItem value="price_desc">Precio mayor a menor</SelectItem>
            <SelectItem value="stock_asc">Stock menor a mayor</SelectItem>
            <SelectItem value="stock_desc">Stock mayor a menor</SelectItem>
            <SelectItem value="discountedPrice_asc">Precio descuento menor a mayor</SelectItem>
            <SelectItem value="discountedPrice_desc">Precio descuento mayor a menor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-panel mt-6 overflow-x-auto rounded-2xl pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Aplicar descuento</TableHead>
              <TableHead>Precio con descuento</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleResults.map((product) => {
              const discount = discounts[product.id] ?? 0;
              const discountedPrice = product.price * (1 - discount / 100);
              return (
                <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{product.name}</span>
                    {product.hidden ? (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">Oculto</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{brands[product.brand].shortName}</TableCell>
                <TableCell className="text-muted-foreground uppercase">{product.category}</TableCell>
                <TableCell>{formatPrice(product.price)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      product.stock === 0
                        ? "destructive"
                        : product.stock <= 4
                          ? "warning"
                          : "success"
                    }
                  >
                    {product.stock}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={pendingDiscounts[product.id] ?? (discount ? String(discount) : "")}
                      onChange={(event) =>
                        setPendingDiscounts((current) => ({
                          ...current,
                          [product.id]: event.target.value,
                        }))
                      }
                      placeholder="0%"
                      className="w-24"
                    />
                    <Button
                      variant={
                        Number(pendingDiscounts[product.id] ?? discount) === discount
                          ? "secondary"
                          : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        const text = pendingDiscounts[product.id] ?? String(discount ?? 0);
                        const nextDiscount = Math.max(0, Math.min(100, Number(text) || 0));
                        setConfirmState({
                          open: true,
                          title: `Aplicar ${nextDiscount}% de descuento a "${product.name}"?`,
                          description: undefined,
                          onConfirm: () => handleApplyDiscount(product.id),
                        });
                      }}
                      aria-label="Aplicar descuento"
                    >
                      <Check className="size-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>{formatPrice(Math.max(0, discountedPrice))}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `Duplicar "${product.name}"?`,
                          description: undefined,
                          onConfirm: () => handleDuplicateProduct(product),
                        })
                      }
                      title="Duplicar"
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant={product.hidden ? "outline" : "secondary"}
                      size="sm"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `${product.hidden ? "Mostrar" : "Ocultar"} \"${product.name}\"?`,
                          description: undefined,
                          onConfirm: () => handleToggleHidden(product.id),
                        })
                      }
                      title={product.hidden ? "Mostrar" : "Ocultar"}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `Editar "${product.name}"?`,
                          description: undefined,
                          onConfirm: () => openEditProductDialog(product),
                        })
                      }
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        setConfirmState({
                          open: true,
                          title: `Eliminar "${product.name}"?`,
                          description: "Esta acción no se puede deshacer.",
                          onConfirm: () => handleDeleteProduct(product.id),
                        })
                      }
                      aria-label={`Eliminar ${product.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                  No se encontraron productos.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {visibleResults.length} de {results.length} productos mostrados
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPage(0)} disabled={!hasPreviousPage}>
            Principio
          </Button>
          <div className="flex items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`rounded-full px-3 py-1 ${index === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-slate-100"}`}
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={!hasNextPage}>
            Último
          </Button>
        </div>
      </div>

      <ProductEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productForm={productForm}
        setProductForm={setProductForm}
        onSave={handleSaveProduct}
      />
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Sí"
        cancelLabel="No"
        onConfirm={() => confirmState.onConfirm()}
      />
    </main>
  );
}

function ProductEditDialog({
  open,
  onOpenChange,
  productForm,
  setProductForm,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productForm: ProductFormState | null;
  setProductForm: (form: ProductFormState | null) => void;
  onSave: () => void;
}) {
  const [newFeature, setNewFeature] = useState("");
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
  const [inlineFeatureText, setInlineFeatureText] = useState("");

  const handleAddFeature = () => {
    if (!productForm) return;
    const feature = newFeature.trim();
    if (!feature) return;

    setProductForm({
      ...productForm,
      features: [...productForm.features, feature],
    });
    setNewFeature("");
  };

  const handleStartInlineEdit = (index: number) => {
    if (!productForm) return;
    setEditingFeatureIndex(index);
    setInlineFeatureText(productForm.features[index] ?? "");
  };

  const handleSaveInlineEdit = () => {
    if (!productForm || editingFeatureIndex === null) return;
    const feature = inlineFeatureText.trim();
    if (!feature) return;

    setProductForm({
      ...productForm,
      features: productForm.features.map((item, index) =>
        index === editingFeatureIndex ? feature : item,
      ),
    });
    setEditingFeatureIndex(null);
    setInlineFeatureText("");
  };

  const handleCancelInlineEdit = () => {
    setEditingFeatureIndex(null);
    setInlineFeatureText("");
  };

  const handleDeleteFeature = (index: number) => {
    if (!productForm) return;
    setProductForm({
      ...productForm,
      features: productForm.features.filter((_, i) => i !== index),
    });
    if (editingFeatureIndex === index) {
      handleCancelInlineEdit();
    }
  };

  const handleAddImageFile = (file: File | null) => {
    if (!productForm || !file) return;

    const imageUrl = URL.createObjectURL(file);

    setProductForm({
      ...productForm,
      images: [...productForm.images, imageUrl],
    });
  };

  const handleRemoveImage = (index: number) => {
    if (!productForm) return;
    setProductForm({
      ...productForm,
      images: productForm.images.filter((_, i) => i !== index),
    });
  };

  const handleSelectCover = (index: number) => {
    if (!productForm) return;
    const imageToCover = productForm.images[index];
    if (!imageToCover) return;
    const rest = productForm.images.filter((_, i) => i !== index);
    setProductForm({
      ...productForm,
      images: [imageToCover, ...rest],
    });
  };

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (!productForm) return;
    if (toIndex < 0 || toIndex >= productForm.images.length) return;

    const nextImages = [...productForm.images];
    const [movedImage] = nextImages.splice(fromIndex, 1);
    if (!movedImage) return;
    nextImages.splice(toIndex, 0, movedImage);

    setProductForm({
      ...productForm,
      images: nextImages,
    });
  };

  const handleSelectImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    handleAddImageFile(file);
  };

  if (!productForm) return null;

  const isNewProduct = productForm.id === "";
  const ganancias = productForm.price - productForm.gastos;
  const isImmediate = productForm.deliveryUnit === "inmediata";
  const priceValue = String(productForm.price);
  const gastosValue = String(productForm.gastos);
  const discountValue = String(productForm.discount);
  const stockValue = String(productForm.stock);
  const deliveryAmountValue = String(productForm.deliveryAmount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{productForm.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-name">Nombre</Label>
            <Input
              id="new-name"
              value={productForm.name}
              onChange={(event) =>
                setProductForm({ ...productForm, name: event.target.value })
              }
              placeholder="Nombre del producto"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-sector">Seleccionar sector</Label>
            <Select
              value={productForm.brand}
              onValueChange={(value) => {
                const nextBrand = value as BrandSlug;
                const nextCategory = brands[nextBrand].categories[0]?.slug ?? "";

                setProductForm({
                  ...productForm,
                  brand: nextBrand,
                  category: nextCategory,
                });
              }}
            >
              <SelectTrigger id="new-sector" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {brandList.map((brand) => (
                  <SelectItem key={brand.slug} value={brand.slug}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-category">Categoría</Label>
            <Select
              value={productForm.category}
              onValueChange={(value) =>
                setProductForm({ ...productForm, category: value })
              }
            >
              <SelectTrigger id="new-category" className="w-full">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {brands[productForm.brand].categories.map((category) => (
                  <SelectItem key={category.slug} value={category.slug}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-price">Precio ($)</Label>
            <Input
              id="new-price"
              type="number"
              value={priceValue}
              onFocus={(event) => event.target.select()}
              onChange={(event) =>
                setProductForm({ ...productForm, price: Number(event.target.value) })
              }
              placeholder="Precio"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-gastos">Gastos ($)</Label>
            <Input
              id="new-gastos"
              type="number"
              value={gastosValue}
              onFocus={(event) => event.target.select()}
              onChange={(event) =>
                setProductForm({ ...productForm, gastos: Number(event.target.value) })
              }
              placeholder="Gastos"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-discount">Descuento (%)</Label>
            <Input
              id="new-discount"
              type="number"
              min={0}
              max={100}
              value={discountValue}
              onFocus={(event) => event.target.select()}
              onChange={(event) =>
                setProductForm({ ...productForm, discount: Number(event.target.value) })
              }
              placeholder="Descuento (%)"
            />
          </div>
          <div className="space-y-2">
            <Label>Ganancias</Label>
            <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-foreground">
              {ganancias >= 0 ? formatPrice(ganancias) : `-${formatPrice(Math.abs(ganancias))}`}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-unit">Tiempo de entrega</Label>
            <Select
              value={productForm.deliveryUnit}
              onValueChange={(value) =>
                setProductForm({
                  ...productForm,
                  deliveryUnit: value as DeliveryUnit,
                })
              }
            >
              <SelectTrigger id="delivery-unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inmediata">Entrega inmediata</SelectItem>
                <SelectItem value="horas">Horas</SelectItem>
                <SelectItem value="dias">Días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-amount">Cantidad</Label>
            <Input
              id="delivery-amount"
              type="number"
              min={1}
              value={deliveryAmountValue}
              onFocus={(event) => event.target.select()}
              onChange={(event) =>
                setProductForm({
                  ...productForm,
                  deliveryAmount: Number(event.target.value),
                })
              }
              placeholder="Cantidad"
              disabled={isImmediate}
            />
          </div>
          <div className="space-y-2">
            <Label>Entrega</Label>
            <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-foreground">
              {isImmediate
                ? "Entrega inmediata"
                : `${productForm.deliveryAmount} ${productForm.deliveryUnit}`}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-stock">Stock</Label>
            <Input
              id="new-stock"
              type="number"
              value={stockValue}
              onFocus={(event) => event.target.select()}
              onChange={(event) =>
                setProductForm({ ...productForm, stock: Number(event.target.value) })
              }
              placeholder="Stock"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-desc">Descripción</Label>
            <Textarea
              id="new-desc"
              rows={3}
              value={productForm.description}
              onChange={(event) =>
                setProductForm({ ...productForm, description: event.target.value })
              }
              placeholder="Descripción del producto"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-feature">Características</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                id="new-feature"
                value={newFeature}
                onChange={(event) => setNewFeature(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddFeature();
                  }
                }}
                placeholder="Agregar característica"
              />
              <Button type="button" onClick={handleAddFeature} className="whitespace-nowrap">
                Agregar
              </Button>
            </div>
            {productForm.features.length > 0 && (
              <div className="grid gap-2">
                {productForm.features.map((feature, index) => (
                  <div
                    key={`${feature}-${index}`}
                    className="flex flex-col gap-2 rounded-lg border border-input px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    {editingFeatureIndex === index ? (
                      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                          value={inlineFeatureText}
                          onChange={(event) => setInlineFeatureText(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleSaveInlineEdit();
                            }
                          }}
                          className="flex-1 min-w-0"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleSaveInlineEdit}
                            aria-label={`Guardar edición de característica ${index + 1}`}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleCancelInlineEdit}
                            aria-label={`Cancelar edición de característica ${index + 1}`}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center justify-between gap-2">
                        <span className="truncate">{feature}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleStartInlineEdit(index)}
                            aria-label={`Editar característica ${index + 1}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDeleteFeature(index)}
                            aria-label={`Eliminar característica ${index + 1}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label htmlFor="new-image">Imágenes</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="relative">
                <Input
                  id="new-image"
                  type="file"
                  accept="image/*"
                  onChange={handleSelectImageFile}
                  className="sr-only"
                />
                <label
                  htmlFor="new-image"
                  className="inline-flex cursor-pointer items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Agregar
                </label>
              </div>
            </div>
            {productForm.images.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {productForm.images.map((image, index) => (
                  <div key={image + index} className="rounded-2xl border border-input overflow-hidden">
                    <div className="relative overflow-hidden bg-slate-950/5">
                      <img
                        src={image}
                        alt={`Imagen ${index + 1}`}
                        className="h-36 w-full object-cover"
                      />
                    </div>
                    <div className="space-y-2 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        <span>{index === 0 ? "Imagen principal" : `Imagen ${index + 1}`}</span>
                        <span className="rounded-full border border-input bg-muted px-2 py-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                          {index === 0 ? "Principal" : "Secundaria"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveImage(index)}
                        >
                          Eliminar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveImage(index, index - 1)}
                          disabled={index === 0}
                        >
                          <ArrowUp className="size-4" />
                          Arriba
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveImage(index, index + 1)}
                          disabled={index === productForm.images.length - 1}
                        >
                          <ArrowDown className="size-4" />
                          Abajo
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSave}>Guardar producto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
