import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, ChevronsUpDown, Edit3, Filter, Pencil, Plus, Save, Search, Trash2, X, Copy, Eye, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { products as productsData } from "@/data/products";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [discountedPriceMin, setDiscountedPriceMin] = useState("");
  const [discountedPriceMax, setDiscountedPriceMax] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [categoryFilterSearch, setCategoryFilterSearch] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("name_asc");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [pendingDiscounts, setPendingDiscounts] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [quickEditProductId, setQuickEditProductId] = useState<string | null>(null);
  const [quickEditForm, setQuickEditForm] = useState<
    Record<
      string,
      { brand: BrandSlug; name: string; category: string; price: number; stock: number; discount: number }
    >
  >({});
  const quickEditRowRef = useRef<HTMLTableRowElement | null>(null);
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
    toast.success("Producto duplicado", {
      description: `Se creó una copia de "${product.name}"`,
    });
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

  const startQuickEdit = (product: Product) => {
    setQuickEditProductId(product.id);
    setQuickEditForm((current) => ({
      ...current,
      [product.id]: {
        brand: product.brand,
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        discount: discounts[product.id] ?? 0,
      },
    }));
  };

  const cancelQuickEdit = () => {
    setQuickEditProductId(null);
    setQuickEditForm((current) => {
      const next = { ...current };
      if (quickEditProductId) delete next[quickEditProductId];
      return next;
    });
  };

  const saveQuickEdit = (product: Product) => {
    const draft = quickEditForm[product.id];
    if (!draft) return;

    const nextBrand = draft.brand;
    const nextName = draft.name.trim() || product.name;
    const nextCategory = draft.category.trim() || product.category;
    const nextPrice = Number(draft.price) || product.price;
    const nextStock = Number(draft.stock) || product.stock;
    const nextDiscount = Math.max(0, Math.min(100, Number(draft.discount) || 0));

    setEditableProducts((current) =>
      current.map((item) =>
        item.id === product.id
          ? {
              ...item,
              brand: nextBrand,
              name: nextName,
              category: nextCategory,
              price: nextPrice,
              stock: nextStock,
            }
          : item,
      ),
    );

    setDiscounts((current) => ({
      ...current,
      [product.id]: nextDiscount,
    }));
    setPendingDiscounts((current) => ({
      ...current,
      [product.id]: String(nextDiscount),
    }));

    setQuickEditProductId(null);
    setQuickEditForm((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
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

  useEffect(() => {
    if (!quickEditProductId) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideRow = quickEditRowRef.current?.contains(target);
      const isInsideSelectPortal = !!(target as Element)?.closest?.("[data-radix-popper-content-wrapper]");

      if (!isInsideRow && !isInsideSelectPortal) {
        cancelQuickEdit();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [quickEditProductId]);

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          editableProducts
            .map((product) => product.category)
            .filter((category) => category && category.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [editableProducts],
  );

  const filteredCategories = useMemo(
    () =>
      availableCategories.filter((category) =>
        category.toLowerCase().includes(categoryFilterSearch.toLowerCase()),
      ),
    [availableCategories, categoryFilterSearch],
  );

  const results = useMemo(() => {
    const filtered = editableProducts.filter((product) => {
      if (brandFilter !== "todas" && product.brand !== brandFilter) return false;
      if (categoryFilter !== "todas" && product.category !== categoryFilter) return false;
      if (query && !product.name.toLowerCase().includes(query.toLowerCase())) return false;

      const priceMinNumber = priceMin === "" ? null : Number(priceMin);
      const priceMaxNumber = priceMax === "" ? null : Number(priceMax);
      const discountedPriceMinNumber = discountedPriceMin === "" ? null : Number(discountedPriceMin);
      const discountedPriceMaxNumber = discountedPriceMax === "" ? null : Number(discountedPriceMax);
      const discountedPrice = product.price * (1 - (discounts[product.id] ?? 0) / 100);

      if (priceMinNumber !== null && product.price < priceMinNumber) return false;
      if (priceMaxNumber !== null && product.price > priceMaxNumber) return false;
      if (discountedPriceMinNumber !== null && discountedPrice < discountedPriceMinNumber) return false;
      if (discountedPriceMaxNumber !== null && discountedPrice > discountedPriceMaxNumber) return false;

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
  }, [editableProducts, query, brandFilter, categoryFilter, priceMin, priceMax, discountedPriceMin, discountedPriceMax, sortOrder, discounts]);

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

      <div className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative w-full max-w-[260px] sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto"
            className="h-9 pl-9"
          />
        </div>

        <Button
          variant={filtersOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setFiltersOpen((current) => !current)}
          className="h-9 shrink-0 gap-1.5 px-2.5"
          aria-expanded={filtersOpen}
        >
          <Filter className="size-4 text-white" />
          Filtros
        </Button>

        <Button
          variant={sortMenuOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setSortMenuOpen((current) => !current)}
          className="h-9 shrink-0 gap-1.5 px-2.5"
          aria-expanded={sortMenuOpen}
        >
          <ArrowUpDown className="size-4 text-white" />
          Ordenar por
        </Button>
      </div>

      {filtersOpen ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Popover open={categoryFilterOpen} onOpenChange={setCategoryFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoryFilterOpen}
                  className="w-full justify-between"
                >
                  <span className="truncate">
                    {categoryFilter === "todas" ? "Todas las categorías" : categoryFilter}
                  </span>
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput
                    value={categoryFilterSearch}
                    onValueChange={setCategoryFilterSearch}
                    placeholder="Buscar categoría..."
                  />
                  <CommandList>
                    <CommandEmpty>No se encontró ninguna categoría.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="todas"
                        onSelect={() => {
                          setCategoryFilter("todas");
                          setCategoryFilterSearch("");
                          setCategoryFilterOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-4",
                            categoryFilter === "todas" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Categorías
                      </CommandItem>
                      {filteredCategories.map((category) => (
                        <CommandItem
                          key={category}
                          value={category}
                          onSelect={() => {
                            setCategoryFilter(category);
                            setCategoryFilterSearch("");
                            setCategoryFilterOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 size-4",
                              categoryFilter === category ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {category}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={0}
                value={priceMin}
                onChange={(event) => setPriceMin(event.target.value)}
                placeholder="Precio desde"
              />
              <Input
                type="number"
                min={0}
                value={priceMax}
                onChange={(event) => setPriceMax(event.target.value)}
                placeholder="Precio hasta"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Select
              value={brandFilter}
              onValueChange={(value) => setBrandFilter(value as BrandSlug | "todas")}
            >
              <SelectTrigger className="w-full">
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
          </div>
        </div>
      ) : null}

      {sortMenuOpen ? (
        <div className="mt-4 w-full max-w-[320px]">
          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as SortOrder)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Producto A-Z</SelectItem>
              <SelectItem value="name_desc">Producto Z-A</SelectItem>
              <SelectItem value="price_asc">Precio menor a mayor</SelectItem>
              <SelectItem value="price_desc">Precio mayor a menor</SelectItem>
              <SelectItem value="stock_asc">Stock menor a mayor</SelectItem>
              <SelectItem value="stock_desc">Stock mayor a menor</SelectItem>
              <SelectItem value="discountedPrice_asc">Precio con descuento menor a mayor</SelectItem>
              <SelectItem value="discountedPrice_desc">Precio con descuento mayor a menor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="glass-panel mt-6 overflow-x-auto rounded-2xl pb-2">
        <Table className="text-center">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Producto</TableHead>
              <TableHead className="text-center">Sector</TableHead>
              <TableHead className="text-center">Categoría</TableHead>
              <TableHead className="text-center">Precio</TableHead>
              <TableHead className="text-center">Stock</TableHead>
              <TableHead className="text-center">Descuento</TableHead>
              <TableHead className="text-center">Precio con descuento</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleResults.map((product) => {
              const discount = discounts[product.id] ?? 0;
              const discountedPrice = product.price * (1 - discount / 100);
              const isQuickEditing = quickEditProductId === product.id;
              const quickDraft = quickEditForm[product.id] ?? {
                brand: product.brand,
                name: product.name,
                category: product.category,
                price: product.price,
                stock: product.stock,
                discount,
              };
              const activeQuickBrand = quickDraft.brand ?? product.brand;
              const brandCategoryOptions = brands[activeQuickBrand]?.categories ?? [];

              return (
                <TableRow key={product.id} ref={quickEditProductId === product.id ? quickEditRowRef : undefined}>
                  {isQuickEditing ? (
                    <>
                      <TableCell>
                        <Input
                          value={quickDraft.name}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [product.id]: { ...quickDraft, name: event.target.value },
                            }))
                          }
                          className="w-full min-w-[180px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={activeQuickBrand}
                          onValueChange={(value) => {
                            const nextBrand = value as BrandSlug;
                            const nextCategory = brands[nextBrand].categories[0]?.slug ?? quickDraft.category;
                            setQuickEditForm((current) => ({
                              ...current,
                              [product.id]: {
                                ...quickDraft,
                                brand: nextBrand,
                                category: nextCategory,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger className="min-w-[120px]">
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
                      </TableCell>
                      <TableCell>
                        <Select
                          value={quickDraft.category}
                          onValueChange={(value) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [product.id]: { ...quickDraft, category: value },
                            }))
                          }
                        >
                          <SelectTrigger className="min-w-[140px]">
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {brandCategoryOptions.map((category) => (
                              <SelectItem key={category.slug} value={category.slug}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={quickDraft.price}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [product.id]: { ...quickDraft, price: Number(event.target.value) },
                            }))
                          }
                          className="w-24 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          value={quickDraft.stock}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [product.id]: { ...quickDraft, stock: Number(event.target.value) },
                            }))
                          }
                          className="w-20 text-center"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={quickDraft.discount}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [product.id]: { ...quickDraft, discount: Number(event.target.value) },
                            }))
                          }
                          className="w-20 text-center"
                        />
                      </TableCell>
                      <TableCell>{formatPrice(Math.max(0, quickDraft.price * (1 - quickDraft.discount / 100)))}</TableCell>
                      <TableCell>
                        <div className="flex flex-nowrap items-center justify-start gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setConfirmState({
                                open: true,
                                title: `Guardar cambios de "${product.name}"?`,
                                description: undefined,
                                onConfirm: () => saveQuickEdit(product),
                              })
                            }
                            className="h-8 flex-none gap-2 px-3 text-xs"
                          >
                            <Check className="h-4 w-4" />
                            <span>Guardar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelQuickEdit}
                            className="h-8 flex-none gap-2 px-3 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <X className="size-4" />
                            <span>Cancelar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
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
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={pendingDiscounts[product.id] ?? (discount ? String(discount) : "")}
                          placeholder="0%"
                          className="w-24 border-0 shadow-none bg-transparent px-0 text-center cursor-default"
                          readOnly
                          tabIndex={-1}
                          onFocus={(e) => (e.currentTarget as HTMLInputElement).blur()}
                          onMouseDown={(e) => e.preventDefault()}
                        />
                      </TableCell>
                      <TableCell>{formatPrice(Math.max(0, discountedPrice))}</TableCell>
                      <TableCell>
                        <div className="flex flex-nowrap items-center justify-end gap-2">
                          <label className="inline-flex h-8 items-center gap-3 rounded-2xl border border-border/60 bg-background/80 px-3">
                            <span className="text-sm">{product.hidden ? "No disponible" : "Disponible"}</span>
                            <Switch
                              checked={!product.hidden}
                              onCheckedChange={() =>
                                setConfirmState({
                                  open: true,
                                  title: `${product.hidden ? "Mostrar" : "Ocultar"} "${product.name}"?`,
                                  description: undefined,
                                  onConfirm: () => handleToggleHidden(product.id),
                                })
                              }
                            />
                          </label>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startQuickEdit(product)}
                            title="Editar rápido"
                            className="h-8 gap-2 px-3 text-xs"
                          >
                            <Edit3 className="h-4 w-4" />
                            <span>Editar rápido</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditProductDialog(product)}
                            title="Editar"
                            className="h-8 gap-2 px-3 text-xs"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="text-[11px]">Editar</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateProduct(product)}
                            title="Duplicar"
                            className="h-8 gap-2 px-3 text-xs"
                          >
                            <Copy className="h-4 w-4" />
                            <span className="text-[11px]">Duplicar</span>
                          </Button>

                          <Button
                            variant="ghost"
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
                            className="h-8 gap-2 px-3 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="text-[11px]">Eliminar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
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
        confirmLabel={(confirmState as any).confirmLabel ?? "Sí"}
        cancelLabel="No"
        onConfirm={() => {
          confirmState.onConfirm();
          setConfirmState((s) => ({ ...s, open: false }));
        }}
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
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const initialFormRef = useRef<string>(JSON.stringify(productForm));
  useEffect(() => {
    if (open) {
      initialFormRef.current = JSON.stringify(productForm);
    }
  }, [open, productForm]);

  const hasChanges = useMemo(() => JSON.stringify(productForm) !== initialFormRef.current, [productForm]);

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

  const [confirmDeleteFeatureOpen, setConfirmDeleteFeatureOpen] = useState(false);
  const [featureToDeleteIndex, setFeatureToDeleteIndex] = useState<number | null>(null);

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
  const availableCategories = brands[productForm.brand]?.categories ?? [];
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
              onValueChange={(value) => setProductForm({ ...productForm, category: value })}
            >
              <SelectTrigger id="new-category" className="w-full">
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((category) => (
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
            <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-foreground opacity-60">
              {ganancias >= 0 ? formatPrice(ganancias) : `-${formatPrice(Math.abs(ganancias))}`}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-unit">Tiempo de entrega</Label>
            <Select value={productForm.deliveryUnit} onValueChange={(value) => setProductForm({ ...productForm, deliveryUnit: value as DeliveryUnit })}>
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
            <Label htmlFor="delivery-amount">Cantidad de entrega</Label>
            <Input
              id="delivery-amount"
              type="number"
              min={1}
              value={isImmediate ? "" : deliveryAmountValue}
              onFocus={(event) => event.target.select()}
              onChange={(event) =>
                setProductForm({
                  ...productForm,
                  deliveryAmount: Number(event.target.value),
                })
              }
              placeholder={isImmediate ? "" : "Cantidad"}
              disabled={isImmediate}
            />
          </div>
          <div className="space-y-2">
            <Label>Entrega</Label>
            <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-foreground opacity-60">
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
                placeholder="Escribir nueva característica"
              />
              <Button type="button" onClick={handleAddFeature} className="whitespace-nowrap">
                <Plus className="h-4 w-4" /> Agregar
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
                            size="sm"
                            className="h-8 gap-2 px-3 text-sm"
                            onClick={handleSaveInlineEdit}
                            aria-label={`Guardar edición de característica ${index + 1}`}
                          >
                            <Check className="h-4 w-4" />
                            <span>Guardar</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                            onClick={handleCancelInlineEdit}
                            aria-label={`Cancelar edición de característica ${index + 1}`}
                          >
                            <X className="h-4 w-4" />
                            <span>Cancelar</span>
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
                              size="sm"
                              className="h-8 gap-2 px-3 text-sm"
                              onClick={() => handleStartInlineEdit(index)}
                              aria-label={`Editar característica ${index + 1}`}
                            >
                              <Pencil className="h-4 w-4" />
                              <span>Editar</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setFeatureToDeleteIndex(index);
                                setConfirmDeleteFeatureOpen(true);
                              }}
                              aria-label={`Eliminar característica ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span>Eliminar</span>
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
                  <Plus className="h-4 w-4 mr-2 text-primary-foreground" /> Agregar
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
                          disabled
                        >
                          Eliminar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveImage(index, index - 1)}
                          disabled
                        >
                          <ArrowUp className="size-4" />
                          Arriba
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => moveImage(index, index + 1)}
                          disabled
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
        <ConfirmDialog
          open={confirmDeleteFeatureOpen}
          onOpenChange={(open) => setConfirmDeleteFeatureOpen(open)}
          title={
            featureToDeleteIndex !== null
              ? `Eliminar "${productForm.features[featureToDeleteIndex]}"?`
              : "Eliminar característica?"
          }
          description="Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={() => {
            if (featureToDeleteIndex !== null) handleDeleteFeature(featureToDeleteIndex);
            setConfirmDeleteFeatureOpen(false);
            setFeatureToDeleteIndex(null);
          }}
        />

        <DialogFooter>
          <div className="flex items-center justify-end w-full gap-2">
            <div className="flex gap-2">
              <Button
                className="bg-white text-primary-foreground hover:bg-slate-100 h-9 px-4 py-2"
                onClick={() => {
                  if (hasChanges) {
                    setConfirmExitOpen(true);
                  } else {
                    setProductForm(null);
                    onOpenChange(false);
                  }
                }}
              >
                <X className="h-4 w-4 mr-2 text-primary-foreground" /> Salir
              </Button>
              <Button disabled={!hasChanges} onClick={() => setConfirmSaveOpen(true)}>
                <Save className="h-4 w-4 mr-2 text-primary-foreground" /> Guardar producto
              </Button>
            </div>
          </div>
        </DialogFooter>

        <ConfirmDialog
          open={confirmSaveOpen}
          onOpenChange={(open) => setConfirmSaveOpen(open)}
          title={"Guardar cambios?"}
          description={"¿Deseas guardar los cambios realizados en el producto?"}
          confirmLabel="Guardar"
          cancelLabel="Cancelar"
          onConfirm={() => {
            setConfirmSaveOpen(false);
            onSave();
          }}
        />

        <ConfirmDialog
          open={confirmExitOpen}
          onOpenChange={(open) => setConfirmExitOpen(open)}
          title={"Salir sin guardar?"}
          description={"Hay cambios sin guardar. ¿Estás seguro que quieres salir?"}
          confirmLabel="Salir"
          cancelLabel="Cancelar"
          onConfirm={() => {
            setConfirmExitOpen(false);
            setProductForm(null);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
