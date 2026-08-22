import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, ChevronUp, Edit3, Eye, EyeOff, FileText, Filter, Pencil, Plus, Save, Search, Sheet, Trash2, X, Copy, ArrowUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { products as productsData, saveProducts, type ProductSupplier, type ProductVariant } from "@/data/products";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
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
import { moveToTrash } from "@/data/trash";

type DeliveryUnit = "inmediata" | "horas" | "dias";
type CurrencyCode = "ARS" | "USD";
type ProductFormState = {
  id: string;
  name: string;
  brand: BrandSlug | "";
  category: string;
  price: number;
  priceCurrency: CurrencyCode;
  comision: number;
  comisionCurrency: CurrencyCode;
  stock: number;
  description: string;
  features: string[];
  images: string[];
  gastos: number;
  gastosCurrency: CurrencyCode;
  usdRate: number;
  deliveryUnit: DeliveryUnit | "";
  deliveryAmount: number;
  discount: number;
  variants: ProductVariant[];
  supplier: ProductSupplier;
};

export const Route = createFileRoute("/admin/productos")({
  head: () => ({
    meta: [
      { title: "LRG Store Shop - Administrador" },
      {
        name: "description",
        content: "Administrá el catálogo completo: precios, stock y categorías por sector.",
      },
      { property: "og:title", content: "LRG Store Shop - Administrador" },
      { property: "og:description", content: "Gestión de catálogo del negocio LRG." },
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
  const [brandFilter, setBrandFilter] = useState<BrandSlug[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode[]>(["ARS", "USD"]);
  const [priceMode, setPriceMode] = useState<"price" | "storePrice">("storePrice");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [stockOnly, setStockOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [priceFilterOpen, setPriceFilterOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("createdAt_desc");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [pendingDiscounts, setPendingDiscounts] = useState<Record<string, string>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bulkEditQueue, setBulkEditQueue] = useState<string[]>([]);
  const [bulkEditPosition, setBulkEditPosition] = useState(0);
  const [initialVariantId, setInitialVariantId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [usdRate, setUsdRate] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem("lrg:usdRate")) || 0;
  });
  const [usdRatePromptOpen, setUsdRatePromptOpen] = useState(false);
  const [usdRatePromptValue, setUsdRatePromptValue] = useState("");
  const multiProductInputRef = useRef<HTMLInputElement | null>(null);
  const [quickEditProductId, setQuickEditProductId] = useState<string | null>(null);
  const [quickEditVariantId, setQuickEditVariantId] = useState<string | null>(null);
  const [quickEditForm, setQuickEditForm] = useState<
    Record<
      string,
      {
        brand: BrandSlug;
        name: string;
        category: string;
        price: number;
        comision: number;
        gastos: number;
        stock: number;
        discount: number;
      }
    >
  >({});
  const quickEditRowRef = useRef<HTMLTableRowElement | null>(null);
  const productsTableRef = useRef<HTMLDivElement | null>(null);
  const [isProductsHeaderSticky, setIsProductsHeaderSticky] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const [page, setPage] = useState(0);
  // `pageSize` is the confirmed page size; default is 10 products per page
  const [pageSize, setPageSize] = useState<number>(10);
  // `pageSizeInput` is the editable input value the user types before confirming
  const [pageSizeInput, setPageSizeInput] = useState<string>("10");

  useEffect(() => {
    const updateProductsHeaderState = () => {
      const table = productsTableRef.current;
      if (!table) return;

      const topOffset = window.innerWidth >= 1024 ? 0 : 56;
      const bounds = table.getBoundingClientRect();
      setIsProductsHeaderSticky(bounds.top <= topOffset && bounds.bottom > topOffset + 48);
    };

    updateProductsHeaderState();
    window.addEventListener("scroll", updateProductsHeaderState, { passive: true });
    window.addEventListener("resize", updateProductsHeaderState);
    return () => {
      window.removeEventListener("scroll", updateProductsHeaderState);
      window.removeEventListener("resize", updateProductsHeaderState);
    };
  }, []);

  const priceLimit = useMemo(() => {
    const values = products
      .filter((product) => !currencyFilter.length || currencyFilter.includes(product.priceCurrency ?? "ARS"))
      .map((product) => {
        const discount = discounts[product.id] ?? 0;
        return priceMode === "storePrice" ? product.price * (1 - discount / 100) : product.price;
      });
    const maximum = Math.max(0, ...values);
    return Math.max(50, Math.ceil(maximum / 50) * 50);
  }, [products, currencyFilter, priceMode, discounts]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: undefined, onConfirm: () => {} });

  useEffect(() => {
    setEditableProducts(products);
  }, [products]);

  useEffect(() => {
    setPriceMin(0);
    setPriceMax(priceLimit);
  }, [currencyFilter, priceMode, priceLimit]);

  const defaultFormState: ProductFormState = {
    id: "",
    name: "",
    brand: "",
    category: "",
    price: 0,
    priceCurrency: "ARS",
    comision: 0,
    comisionCurrency: "ARS",
    stock: 0,
    description: "",
    features: [],
    images: [],
    gastos: 0,
    gastosCurrency: "ARS",
    usdRate: 0,
    deliveryUnit: "",
    deliveryAmount: 0,
    discount: 0,
    variants: [],
    supplier: { name: "", phone: "", social: "", purchaseDate: "" },
  };

  const handleUsdRateConfirm = () => {
    const nextUsdRate = Number(usdRatePromptValue);
    if (!Number.isFinite(nextUsdRate) || nextUsdRate <= 0) {
      toast.error("Ingresá un valor mayor a 0 para 1 USD.");
      return;
    }
    setUsdRate(nextUsdRate);
    window.localStorage.setItem("lrg:usdRate", String(nextUsdRate));
    setProductForm((current) => (current ? { ...current, usdRate: nextUsdRate } : current));
    setUsdRatePromptOpen(false);
    setUsdRatePromptValue("");
  };

  const openNewProductDialog = () => {
    setCreateChoiceOpen(true);
  };

  const openSingleProductDialog = () => {
    setCreateChoiceOpen(false);
    setEditingProduct(null);
    setInitialVariantId(null);
    setProductForm({
      ...defaultFormState,
      usdRate,
    });
    setCreateDialogOpen(true);
  };

  const handleImportMultipleProducts = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("No se seleccionaron imágenes válidas.");
      return;
    }

    const importedProducts = imageFiles.map((file, index) => {
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const productName = baseName || `Producto importado ${index + 1}`;
      const slugBase = productName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `producto-importado-${Date.now()}-${index + 1}`;
      const defaultBrand: BrandSlug = "arcade";
      const defaultCategory = brands[defaultBrand].categories[0]?.slug ?? "consolas";

      return {
        id: `import-${Date.now()}-${index + 1}`,
        slug: `${slugBase}-${index + 1}`,
        brand: defaultBrand,
        name: productName,
        category: defaultCategory,
        price: 0,
        stock: 1,
        rating: 0,
        reviews: 0,
        short: "Producto agregado desde importación múltiple.",
        description: "Producto creado a partir de una imagen importada desde el dispositivo.",
        features: [],
        images: [URL.createObjectURL(file)],
        createdAt: new Date().toISOString().slice(0, 10),
      } as Product;
    });

    (productsData as Product[]).push(...importedProducts);
    saveProducts(productsData as Product[]);
    setEditableProducts((current) => [...current, ...importedProducts]);
    setCreateChoiceOpen(false);

    toast.success(`Se importaron ${importedProducts.length} productos`, {
      description: "Ya están disponibles en el listado y puedes editarlos como cualquier otro producto.",
    });
  };

  const openEditProductDialog = (product: Product, variant?: ProductVariant) => {
    setEditingProduct(product);
    setInitialVariantId(variant?.id ?? null);
    setProductForm({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      priceCurrency: product.priceCurrency ?? "ARS",
      comision: product.comision ?? 0,
      comisionCurrency: product.comisionCurrency ?? "ARS",
      stock: product.stock,
      description: product.description,
      features: product.features ?? [],
      images: product.images ?? [],
      gastos: product.gastos ?? 0,
      gastosCurrency: product.gastosCurrency ?? "ARS",
      usdRate: product.usdRate ?? usdRate,
      deliveryUnit: "inmediata",
      deliveryAmount: 1,
      discount: discounts[product.id] ?? 0,
      variants: product.variants ?? [],
      supplier: product.supplier ?? { name: "", phone: "", social: "", purchaseDate: "" },
    });
    setPendingDiscounts((current) => ({
      ...current,
      [product.id]: String(discounts[product.id] ?? 0),
    }));
    setEditDialogOpen(true);
  };

  const handleDeleteProduct = (productId: string, variantId?: string) => {
    const product = (productsData as Product[]).find((item) => item.id === productId);
    if (product && variantId) {
      product.variants = (product.variants ?? []).filter((variant) => variant.id !== variantId);
      setEditableProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === productId ? { ...currentProduct, variants: product.variants } : currentProduct,
        ),
      );
      saveProducts(productsData as Product[]);
      return;
    }
    if (product) moveToTrash({ type: "producto", id: product.id, item: product });
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

    const productIndex = (productsData as Product[]).findIndex((product) => product.id === productId);
    if (productIndex !== -1) {
      (productsData as Product[]).splice(productIndex, 1);
      saveProducts(productsData as Product[]);
    }
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
    saveProducts(productsData as Product[]);
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
    saveProducts(productsData as Product[]);
  };

  const getProductSelectionKey = (product: Product, variant?: ProductVariant) =>
    `${product.id}:${variant?.id ?? "base"}`;

  const getProductIdFromSelectionKey = (selectionKey: string) => selectionKey.split(":")[0] ?? selectionKey;

  const toggleProductSelection = (selectionKey: string, checked: boolean) => {
    setSelectedProductIds((current) =>
      checked ? (current.includes(selectionKey) ? current : [...current, selectionKey]) : current.filter((key) => key !== selectionKey),
    );
  };

  const handleBulkDeleteProducts = () => {
    const ids = new Set(selectedProductIds.map(getProductIdFromSelectionKey));
    (productsData as Product[])
      .filter((product) => ids.has(product.id))
      .forEach((product) => moveToTrash({ type: "producto", id: product.id, item: product }));
    setEditableProducts((current) => current.filter((product) => !ids.has(product.id)));
    for (const productId of ids) {
      const index = (productsData as Product[]).findIndex((product) => product.id === productId);
      if (index !== -1) (productsData as Product[]).splice(index, 1);
    }
    saveProducts(productsData as Product[]);
    setSelectedProductIds([]);
  };

  const handleBulkToggleProducts = (hidden: boolean) => {
    const ids = new Set(selectedProductIds.map(getProductIdFromSelectionKey));
    const nextProducts = (productsData as Product[]).map((product) => ids.has(product.id) ? { ...product, hidden } : product);
    productsData.splice(0, productsData.length, ...nextProducts);
    setEditableProducts((current) => current.map((product) => ids.has(product.id) ? { ...product, hidden } : product));
    saveProducts(productsData as Product[]);
  };

  const handleBulkDuplicateProducts = () => {
    const selectedIds = new Set(selectedProductIds.map(getProductIdFromSelectionKey));
    const selected = editableProducts.filter((product) => selectedIds.has(product.id));
    selected.forEach(handleDuplicateProduct);
    setSelectedProductIds([]);
  };

  const handleBulkEditProducts = () => {
    const firstSelectionKey = selectedProductIds[0];
    const firstProductId = firstSelectionKey ? getProductIdFromSelectionKey(firstSelectionKey) : undefined;
    const product = editableProducts.find((item) => item.id === firstProductId);
    if (!product) return;
    setBulkEditQueue(selectedProductIds);
    setBulkEditPosition(0);
    const variantId = firstSelectionKey?.split(":")[1];
    openEditProductDialog(product, variantId && variantId !== "base" ? product.variants?.find((variant) => variant.id === variantId) : undefined);
  };

  const navigateBulkEditProduct = (direction: -1 | 1) => {
    const nextPosition = bulkEditPosition + direction;
    const nextSelectionKey = bulkEditQueue[nextPosition];
    if (!nextSelectionKey) return;
    const nextProduct = editableProducts.find((product) => product.id === getProductIdFromSelectionKey(nextSelectionKey));
    if (!nextProduct) return;
    setBulkEditPosition(nextPosition);
    const variantId = nextSelectionKey.split(":")[1];
    openEditProductDialog(nextProduct, variantId && variantId !== "base" ? nextProduct.variants?.find((variant) => variant.id === variantId) : undefined);
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

  const getQuickEditKey = (product: Product, variant?: ProductVariant) =>
    `${product.id}:${variant?.id ?? "base"}`;

  const startQuickEdit = (product: Product, variant?: ProductVariant) => {
    const key = getQuickEditKey(product, variant);
    const source = variant ?? product;
    setQuickEditProductId(product.id);
    setQuickEditVariantId(variant?.id ?? null);
    setQuickEditForm((current) => ({
      ...current,
      [key]: {
        brand: product.brand,
        name: source.name,
        category: product.category,
        price: source.price,
        comision: source.comision ?? 0,
        gastos: source.gastos ?? 0,
        stock: source.stock,
        discount: variant?.discount ?? discounts[product.id] ?? 0,
      },
    }));
  };

  const cancelQuickEdit = () => {
    setQuickEditProductId(null);
    setQuickEditVariantId(null);
    setQuickEditForm((current) => {
      const next = { ...current };
      if (quickEditProductId) delete next[getQuickEditKey({ id: quickEditProductId } as Product, quickEditVariantId ? { id: quickEditVariantId } as ProductVariant : undefined)];
      return next;
    });
  };

  const showStockExceededToast = (productName: string, maxStock: number) => {
    toast.error("No hay más stock disponible para agregar.", {
      description: `La cantidad supera el stock disponible de "${productName}" (${maxStock}).`,
    });
  };

  const saveQuickEdit = (product: Product, variant?: ProductVariant) => {
    const key = getQuickEditKey(product, variant);
    const draft = quickEditForm[key];
    if (!draft) return;

    const nextBrand = draft.brand;
    const nextName = draft.name.trim() || product.name;
    const nextCategory = draft.category.trim() || product.category;
    const nextPrice = Number(draft.price) || product.price;
    const nextComision = Math.max(0, Number(draft.comision) || 0);
    const nextGastos = Math.max(0, Number(draft.gastos) || 0);
    const nextStock = Number(draft.stock) || product.stock;
    const nextDiscount = Math.max(0, Math.min(100, Number(draft.discount) || 0));

    setEditableProducts((current) => current.map((item) => {
      if (item.id !== product.id) return item;
      if (variant) {
        return {
          ...item,
          variants: item.variants?.map((itemVariant) =>
            itemVariant.id === variant.id
              ? { ...itemVariant, name: nextName, price: nextPrice, comision: nextComision, gastos: nextGastos, stock: nextStock, discount: nextDiscount }
              : itemVariant,
          ),
        };
      }
      return { ...item, brand: nextBrand, name: nextName, category: nextCategory, price: nextPrice, comision: nextComision, gastos: nextGastos, stock: nextStock };
    }));

    const productIndex = (productsData as Product[]).findIndex((item) => item.id === product.id);
    if (productIndex !== -1) {
      const existing = (productsData as Product[])[productIndex] as Product;
      if (variant) {
        existing.variants = existing.variants?.map((itemVariant) =>
          itemVariant.id === variant.id
            ? { ...itemVariant, name: nextName, price: nextPrice, comision: nextComision, gastos: nextGastos, stock: nextStock, discount: nextDiscount }
            : itemVariant,
        );
      } else {
        existing.brand = nextBrand;
        existing.name = nextName;
        existing.category = nextCategory;
        existing.price = nextPrice;
        existing.comision = nextComision;
        existing.gastos = nextGastos;
        existing.stock = nextStock;
      }
      saveProducts(productsData as Product[]);
    }

    setDiscounts((current) => ({
      ...current,
      [product.id]: nextDiscount,
    }));
    setPendingDiscounts((current) => ({
      ...current,
      [product.id]: String(nextDiscount),
    }));

    setQuickEditProductId(null);
    setQuickEditVariantId(null);
    setQuickEditForm((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  type SortOrder =
    | "name_asc"
    | "name_desc"
    | "createdAt_asc"
    | "createdAt_desc"
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
              comision: productForm.comision,
              comisionCurrency: productForm.comisionCurrency,
              gastos: productForm.gastos,
              gastosCurrency: productForm.gastosCurrency,
              stock: productForm.stock,
              description: productForm.description,
              features: productForm.features,
              images: productForm.images,
              variants: productForm.variants,
              supplier: productForm.supplier,
            }
          : item,
      );

      if (!editingProduct) {
        savedProductId = `new-${Date.now()}`;
        const newProduct = {
          id: savedProductId,
          slug: productForm.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, ""),
          brand: productForm.brand,
          name: productForm.name,
          category: productForm.category,
          price: productForm.price,
          priceCurrency: productForm.priceCurrency,
          comision: productForm.comision,
          comisionCurrency: productForm.comisionCurrency,
          gastos: productForm.gastos,
          gastosCurrency: productForm.gastosCurrency,
          usdRate: productForm.usdRate,
          stock: productForm.stock,
          rating: 0,
          reviews: 0,
          short: productForm.description,
          description: productForm.description,
          features: productForm.features,
          images: productForm.images,
          variants: productForm.variants,
          supplier: productForm.supplier,
          createdAt: new Date().toISOString().slice(0, 10),
        } as Product;

        (productsData as Product[]).push(newProduct);
        return [...current, newProduct];
      }

      const existingIndex = (productsData as Product[]).findIndex((item) => item.id === productForm.id);
      if (existingIndex !== -1) {
        const existing = (productsData as Product[])[existingIndex] as Product;
        existing.name = productForm.name;
        existing.brand = productForm.brand;
        existing.category = productForm.category;
        existing.price = productForm.price;
        existing.priceCurrency = productForm.priceCurrency;
        existing.comision = productForm.comision;
        existing.comisionCurrency = productForm.comisionCurrency;
        existing.gastos = productForm.gastos;
        existing.gastosCurrency = productForm.gastosCurrency;
        existing.usdRate = productForm.usdRate;
        existing.stock = productForm.stock;
        existing.description = productForm.description;
        existing.features = productForm.features;
        existing.images = productForm.images;
        existing.variants = productForm.variants;
        existing.supplier = productForm.supplier;
      }

      return updated;
    });

    if (savedProductId) {
      setDiscounts((current) => ({
        ...current,
        [savedProductId]: productForm.discount,
      }));
    }

    saveProducts(productsData as Product[]);
    const currentBulkSelectionKey = bulkEditQueue[bulkEditPosition];
    const remainingBulkQueue = currentBulkSelectionKey
      ? bulkEditQueue.filter((selectionKey) => selectionKey !== currentBulkSelectionKey)
      : [];
    const nextBulkSelectionKey = remainingBulkQueue[0];
    if (nextBulkSelectionKey) {
      const nextProduct = editableProducts.find((product) => product.id === getProductIdFromSelectionKey(nextBulkSelectionKey));
      if (nextProduct) {
        setBulkEditQueue(remainingBulkQueue);
        setBulkEditPosition(0);
        const variantId = nextBulkSelectionKey.split(":")[1];
        openEditProductDialog(nextProduct, variantId && variantId !== "base" ? nextProduct.variants?.find((variant) => variant.id === variantId) : undefined);
        return;
      }
    }
    setBulkEditQueue([]);
    setBulkEditPosition(0);
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
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
  }, [quickEditProductId, quickEditVariantId]);

  useEffect(() => {
    if (!sortMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sortMenuRef.current?.contains(target) || sortButtonRef.current?.contains(target)) return;
      setSortMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [sortMenuOpen]);

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

  const results = useMemo(() => {
    const filtered = editableProducts.filter((product) => {
      if (brandFilter.length && !brandFilter.includes(product.brand)) return false;
      if (categoryFilter.length && !categoryFilter.includes(product.category)) return false;
      if (currencyFilter.length && !currencyFilter.includes(product.priceCurrency ?? "ARS")) return false;
      if (query && !product.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (discountOnly && (discounts[product.id] ?? 0) <= 0) return false;
      if (stockOnly && product.stock <= 0) return false;
      if (availableOnly && product.hidden) return false;
      const storePrice = product.price * (1 - (discounts[product.id] ?? 0) / 100);
      const selectedPrice = priceMode === "storePrice" ? storePrice : product.price;
      if (selectedPrice < priceMin || selectedPrice > priceMax) return false;

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
        case "createdAt_asc":
          return a.createdAt.localeCompare(b.createdAt);
        case "createdAt_desc":
          return b.createdAt.localeCompare(a.createdAt);
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
  }, [editableProducts, query, brandFilter, categoryFilter, currencyFilter, priceMode, priceMin, priceMax, discountOnly, stockOnly, availableOnly, sortOrder, discounts]);

  useEffect(() => {
    setPage(0);
  }, [results]);

  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  const visibleResults = useMemo(() => {
    if (!pageSize || pageSize <= 0) return [] as typeof results;
    return results.slice(page * pageSize, page * pageSize + pageSize);
  }, [results, page, pageSize]);
  const displayRows = useMemo(
    () => visibleResults.flatMap((product) =>
      product.variants && product.variants.length >= 2
        ? product.variants.map((variant) => ({ product, variant }))
        : [{ product, variant: undefined }],
    ),
    [visibleResults],
  );
  const visibleProductSelectionKeys = displayRows.map(({ product, variant }) => getProductSelectionKey(product, variant));
  const selectedVisibleProductKeys = visibleProductSelectionKeys.filter((key) => selectedProductIds.includes(key));
  const allVisibleProductsSelected = visibleProductSelectionKeys.length > 0 && selectedVisibleProductKeys.length === visibleProductSelectionKeys.length;
  const someVisibleProductsSelected = selectedVisibleProductKeys.length > 0 && !allVisibleProductsSelected;
  const totalPages = pageSize && pageSize > 0 ? Math.max(1, Math.ceil(results.length / pageSize)) : 1;
  const hasNextPage = page + 1 < totalPages;
  const hasPreviousPage = page > 0;
  const activeFilterCount =
    categoryFilter.length +
    brandFilter.length +
    currencyFilter.length +
    (priceMode !== "storePrice" ? 1 : 0) +
    (priceMin > 0 ? 1 : 0) +
    (priceMax < priceLimit ? 1 : 0) +
    (discountOnly ? 1 : 0) +
    (stockOnly ? 1 : 0) +
    (availableOnly ? 1 : 0);

  const resetFilters = () => {
    setCategoryFilter([]);
    setBrandFilter([]);
    setCurrencyFilter(["ARS", "USD"]);
    setPriceMode("storePrice");
    setPriceMin(0);
    setPriceMax(priceLimit);
    setDiscountOnly(false);
    setStockOnly(false);
    setAvailableOnly(false);
  };
  const priceDisplayCurrency = currencyFilter.length === 1 ? currencyFilter[0] : "ARS";
  const priceCurrencyLabel =
    currencyFilter.includes("ARS") && currencyFilter.includes("USD")
      ? "$/USD"
      : currencyFilter.includes("USD")
        ? "USD"
        : "$";
  const priceFilterCount = currencyFilter.length + 1;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-55 flex-1">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
          <h1 className="mt-2 text-3xl font-semibold">Productos</h1>
        </div>

        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto"
            className="h-9 pl-9"
          />
        </div>

        <div className="relative flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="relative">
            <Button
              ref={sortButtonRef as any}
              variant={sortMenuOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSortMenuOpen((current) => !current)}
              className="h-9 shrink-0 gap-1.5 px-2.5"
              aria-expanded={sortMenuOpen}
            >
              <ArrowUpDown className="size-4 text-white" />
              Ordenar por
            </Button>

            {sortMenuOpen ? (
              <div ref={sortMenuRef} className="absolute left-0 top-full z-20 mt-2 w-[320px]">
                <div className="rounded-xl border border-border/60 bg-background/95 p-2 shadow-lg backdrop-blur-sm">
                  {(
                    [
                      ["name_asc", "Producto: A-Z"],
                      ["name_desc", "Producto: Z-A"],
                      ["createdAt_asc", "Producto agregado: Antiguo a nuevo"],
                      ["createdAt_desc", "Producto agregado: Nuevo a antiguo"],
                      ["price_asc", "Precio: menor a mayor"],
                      ["price_desc", "Precio: mayor a menor"],
                      ["discountedPrice_asc", "Precio en la tienda: menor a mayor"],
                      ["discountedPrice_desc", "Precio en la tienda: mayor a menor"],
                      ["stock_asc", "Stock: menor a mayor"],
                      ["stock_desc", "Stock: mayor a menor"],
                    ] as [SortOrder, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSortOrder(value);
                        setSortMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                        sortOrder === value ? "bg-surface-2 text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <span>{label}</span>
                      {sortOrder === value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
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
 
          <Button className="h-9 gap-2" onClick={openNewProductDialog}>
            <Plus className="size-4" /> Nuevo producto
          </Button>

          <Button
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700"
            onClick={() => {
              const rows: (string | number)[][] = [["ID","Nombre","Marca","Categoria","Precio","Stock","Descuento"]];

              for (const p of results) {
                const discounted = discounts[p.id] ?? 0;
                rows.push([
                  p.id,
                  p.name,
                  p.brand,
                  p.category ?? "",
                  p.price ?? 0,
                  p.stock ?? 0,
                  `${discounted}%`,
                ]);
              }

              const worksheet = XLSX.utils.aoa_to_sheet(rows);
              const workbook = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(workbook, worksheet, "Productos");
              const date = new Date().toISOString().slice(0, 10);
              XLSX.writeFile(workbook, `productos_${date}_filtered.xlsx`);
            }}
          >
            <Sheet className="size-4" />
            Exportar Excel
          </Button>

          <Button
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700"
            onClick={() => {
              const rows = results.map((p) => {
                const discounted = discounts[p.id] ?? 0;
                return [p.id, p.name, p.brand, p.category ?? "", p.price ?? 0, p.stock ?? 0, `${discounted}%`];
              });

              const tableHtml = `
                <html>
                  <head>
                    <meta charset="utf-8" />
                    <style>
                      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
                      table { border-collapse: collapse; width: 100%; font-size: 12px; }
                      th, td { border: 1px solid #d4d4d4; padding: 8px; text-align: left; }
                      th { background: #f3f3f3; }
                    </style>
                  </head>
                  <body>
                    <h2>Listado de productos</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Nombre</th>
                          <th>Marca</th>
                          <th>Categoria</th>
                          <th>Precio</th>
                          <th>Stock</th>
                          <th>Descuento</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rows
                          .map(
                            (row) =>
                              `<tr>${row
                                .map((cell) => `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
                                .join("")}</tr>`,
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </body>
                </html>
              `;

              const printWindow = window.open("", "_blank");
              if (!printWindow) return;
              const date = new Date().toISOString().slice(0, 10);
              printWindow.document.title = `productos_${date}_filtered`;
              printWindow.document.write(tableHtml);
              printWindow.document.close();
              printWindow.focus();
              printWindow.print();
            }}
          >
            <FileText className="size-4" />
            Exportar PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2 border-amber-500/50 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 hover:text-amber-700"
            onClick={() => {
              setUsdRatePromptValue(usdRate > 0 ? String(usdRate) : "");
              setUsdRatePromptOpen(true);
            }}
          >
            Seleccionar valor USD
          </Button>
        </div>
      </div>

      {filtersOpen ? (
        <div className="glass-panel mt-4 w-fit max-w-full space-y-6 rounded-2xl p-5">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setCategoriesOpen((current) => !current)}
              className="flex items-center gap-2 text-sm font-medium"
              aria-expanded={categoriesOpen}
            >
              <span>Categorías</span>
              {categoryFilter.length > 0 && <Badge variant="secondary">{categoryFilter.length}</Badge>}
              {categoriesOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {categoriesOpen && (
              <div className="space-y-2.5">
                {availableCategories.map((category) => (
                  <label key={category} className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox
                      checked={categoryFilter.includes(category)}
                      onCheckedChange={(checked) =>
                        setCategoryFilter((current) =>
                          checked ? [...current, category] : current.filter((value) => value !== category),
                        )
                      }
                    />
                    <span className="font-medium">{category}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setBrandsOpen((current) => !current)}
              className="flex items-center gap-2 text-sm font-medium"
              aria-expanded={brandsOpen}
            >
              <span>Tienda</span>
              {brandFilter.length > 0 && <Badge variant="secondary">{brandFilter.length}</Badge>}
              {brandsOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {brandsOpen && (
              <div className="space-y-2.5">
                {brandList.map((brand) => (
                  <label key={brand.slug} className="flex cursor-pointer items-start gap-3 text-sm">
                    <Checkbox
                      checked={brandFilter.includes(brand.slug)}
                      onCheckedChange={(checked) =>
                        setBrandFilter((current) =>
                          checked ? [...current, brand.slug] : current.filter((value) => value !== brand.slug),
                        )
                      }
                    />
                    <span className="font-medium">{brand.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPriceFilterOpen((current) => !current)}
              className="flex items-center gap-2 text-sm font-medium"
              aria-expanded={priceFilterOpen}
            >
              <span>Precio</span>
              <Badge variant="secondary">{priceFilterCount}</Badge>
              {priceFilterOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {priceFilterOpen && (
              <div className="space-y-2.5">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={currencyFilter.includes("ARS")}
                    onCheckedChange={(checked) =>
                      setCurrencyFilter((current) =>
                        checked ? [...current, "ARS"] : current.filter((value) => value !== "ARS"),
                      )
                    }
                  />
                  <span className="font-medium">$ (ARS)</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={currencyFilter.includes("USD")}
                    onCheckedChange={(checked) =>
                      setCurrencyFilter((current) =>
                        checked ? [...current, "USD"] : current.filter((value) => value !== "USD"),
                      )
                    }
                  />
                  <span className="font-medium">USD (Dólar)</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={priceMode === "price"}
                    onCheckedChange={(checked) => checked && setPriceMode("price")}
                  />
                  <span className="font-medium">Precio</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <Checkbox
                    checked={priceMode === "storePrice"}
                    onCheckedChange={(checked) => checked && setPriceMode("storePrice")}
                  />
                  <span className="font-medium">Precio en la tienda</span>
                </label>
                <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-foreground/90">
                  <label className="flex shrink-0 items-center gap-2">
                    <span>Desde {priceCurrencyLabel}</span>
                    <Input
                      aria-label="Precio mínimo"
                      type="number"
                      min={0}
                      max={priceLimit}
                      value={priceMin}
                      aria-valuetext={formatPrice(priceMin, priceDisplayCurrency)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (!Number.isFinite(value)) return;
                        setPriceMin(Math.min(Math.max(0, value), priceMax));
                      }}
                      className="h-8 w-20 px-2 sm:w-24"
                    />
                  </label>
                  <label className="flex shrink-0 items-center justify-end gap-2">
                    <span>Hasta {priceCurrencyLabel}</span>
                    <Input
                      aria-label="Precio máximo"
                      type="number"
                      min={0}
                      max={priceLimit}
                      value={priceMax}
                      aria-valuetext={formatPrice(priceMax, priceDisplayCurrency)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (!Number.isFinite(value)) return;
                        setPriceMax(Math.max(Math.min(priceLimit, value), priceMin));
                      }}
                      className="h-8 w-20 px-2 sm:w-24"
                    />
                  </label>
                </div>
                <Slider
                  min={0}
                  max={priceLimit}
                  step={Math.max(1, Math.round(priceLimit / 100))}
                  value={[priceMin, priceMax]}
                  onValueChange={(value) => {
                    const nextMin = value[0] ?? 0;
                    const nextMax = value[1] ?? priceLimit;
                    setPriceMin(Math.min(nextMin, nextMax));
                    setPriceMax(Math.max(nextMin, nextMax));
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
            <Label htmlFor="admin-filter-discount" className="cursor-pointer text-sm">
              Sólo con descuento
            </Label>
            <Switch
              id="admin-filter-discount"
              checked={discountOnly}
              onCheckedChange={setDiscountOnly}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
            <Label htmlFor="admin-filter-stock" className="cursor-pointer text-sm">
              Sólo con stock
            </Label>
            <Switch id="admin-filter-stock" checked={stockOnly} onCheckedChange={setStockOnly} />
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
            <Label htmlFor="admin-filter-available" className="cursor-pointer text-sm">
              Sólo disponible
            </Label>
            <Switch
              id="admin-filter-available"
              checked={availableOnly}
              onCheckedChange={setAvailableOnly}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-0">
            <p className="text-xs text-muted-foreground">{results.length} productos encontrados</p>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="ml-auto flex h-8 px-2 text-xs"
              >
                <X className="mr-1 size-3.5" /> Limpiar
              </Button>
            )}
          </div>
        </div>
      ) : null}

      

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Seleccionar</span>
        <Checkbox
          checked={allVisibleProductsSelected ? true : someVisibleProductsSelected ? "indeterminate" : false}
          onCheckedChange={(checked) => {
            const shouldSelect = checked === true || checked === "indeterminate";
            setSelectedProductIds((current) => shouldSelect
              ? [...new Set([...current, ...visibleProductSelectionKeys])]
              : current.filter((key) => !visibleProductSelectionKeys.includes(key)));
          }}
          aria-label="Seleccionar productos visibles"
        />
        {selectedProductIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedProductIds.length} seleccionados</span>
            <Button size="sm" variant="outline" onClick={handleBulkEditProducts}><Pencil className="size-4" /> Editar</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkToggleProducts(false)}><Eye className="size-4" /> Disponible</Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkToggleProducts(true)}><EyeOff className="size-4" /> No disponible</Button>
            <Button size="sm" variant="outline" onClick={handleBulkDuplicateProducts}><Copy className="size-4" /> Duplicar</Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmState({ open: true, title: "Eliminar productos seleccionados?", description: "Esta acción no se puede deshacer.", onConfirm: handleBulkDeleteProducts })}><Trash2 className="size-4" /> Eliminar</Button>
          </div>
        ) : null}
      </div>

      <div ref={productsTableRef} className="glass-panel mt-3 overflow-visible rounded-2xl pb-2">
        <Table
          containerClassName="overflow-visible"
          className="w-full table-fixed text-center [&_td]:align-middle [&_th]:align-middle"
        >
          <TableHeader
            className={`[&_th]:sticky [&_th]:top-14 [&_th]:z-20 [&_th]:shadow-[0_1px_0_var(--border)] lg:[&_th]:top-0 ${
              isProductsHeaderSticky ? "[&_th]:bg-background" : ""
            }`}
          >
            <TableRow>
              <TableHead className="text-center w-40">Producto</TableHead>
              <TableHead className="text-center w-20">Sector</TableHead>
              <TableHead className="text-center w-24">Categoría</TableHead>
              <TableHead className="text-center w-16">Stock</TableHead>
              <TableHead className="text-center w-24">Mi comisión</TableHead>
              <TableHead className="text-center w-20">Gastos</TableHead>
              <TableHead className="text-center w-20">Precio</TableHead>
              <TableHead className="text-center w-20">Descuento</TableHead>
              <TableHead className="text-center w-24">Precio tienda</TableHead>
              <TableHead className="text-center w-24">Ganancias</TableHead>
              <TableHead className="text-center flex-1">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayRows.map(({ product, variant }) => {
              const discount = variant?.discount ?? discounts[product.id] ?? 0;
              const displayPrice = variant?.price ?? product.price;
              const displayStock = variant?.stock ?? product.stock;
              const displayComision = variant?.comision ?? product.comision ?? 0;
              const displayGastos = variant?.gastos ?? product.gastos ?? 0;
              const displayPriceCurrency = variant?.priceCurrency ?? product.priceCurrency ?? "ARS";
              const displayComisionCurrency = variant?.comisionCurrency ?? product.comisionCurrency ?? "ARS";
              const displayGastosCurrency = variant?.gastosCurrency ?? product.gastosCurrency ?? "ARS";
              const displayUsdRate = product.usdRate ?? 0;
              const discountedPrice = displayPrice * (1 - discount / 100);
              const discountedPriceInArs = displayPriceCurrency === "USD" ? discountedPrice * displayUsdRate : discountedPrice;
              const gastosInArs = displayGastosCurrency === "USD" ? displayGastos * displayUsdRate : displayGastos;
              const displayProfit = displayPriceCurrency === displayGastosCurrency
                ? discountedPrice - displayGastos
                : discountedPriceInArs - gastosInArs;
              const displayProfitCurrency = displayPriceCurrency === displayGastosCurrency ? displayPriceCurrency : "ARS";
              const quickEditKey = getQuickEditKey(product, variant);
              const isQuickEditing = quickEditProductId === product.id && quickEditVariantId === (variant?.id ?? null);
              const quickDraft = quickEditForm[quickEditKey] ?? {
                brand: product.brand,
                name: product.name,
                category: product.category,
                price: product.price,
                comision: product.comision ?? 0,
                gastos: product.gastos ?? 0,
                stock: product.stock,
                discount,
              };
              const activeQuickBrand = quickDraft.brand ?? product.brand;
              const brandCategoryOptions = brands[activeQuickBrand]?.categories ?? [];

              return (
                <TableRow key={`${product.id}-${variant?.id ?? "base"}`} ref={isQuickEditing ? quickEditRowRef : undefined}>
                  {isQuickEditing ? (
                    <>
                      <TableCell className="align-middle">
                        <div className="flex min-w-0 items-center gap-2 text-left">
                          <Checkbox
                            checked={selectedProductIds.includes(getProductSelectionKey(product, variant))}
                            onCheckedChange={(checked) => toggleProductSelection(getProductSelectionKey(product, variant), checked === true)}
                            aria-label={`Seleccionar ${product.name}`}
                          />
                          <Input
                            value={quickDraft.name}
                            onChange={(event) =>
                              setQuickEditForm((current) => ({
                                ...current,
                                [quickEditKey]: { ...quickDraft, name: event.target.value },
                              }))
                            }
                            className="w-full min-w-0"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Select
                          value={activeQuickBrand}
                          onValueChange={(value) => {
                            const nextBrand = value as BrandSlug;
                            const nextCategory = brands[nextBrand].categories[0]?.slug ?? quickDraft.category;
                            setQuickEditForm((current) => ({
                              ...current,
                              [quickEditKey]: {
                                ...quickDraft,
                                brand: nextBrand,
                                category: nextCategory,
                              },
                            }));
                          }}
                        >
                          <SelectTrigger className="w-full min-w-0">
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
                      <TableCell className="align-middle">
                        <Select
                          value={quickDraft.category}
                          onValueChange={(value) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [quickEditKey]: { ...quickDraft, category: value },
                            }))
                          }
                        >
                          <SelectTrigger className="w-full min-w-0">
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
                      <TableCell className="align-middle">
                        <Input
                          type="number"
                          min={0}
                          value={quickDraft.stock}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [quickEditKey]: { ...quickDraft, stock: Number(event.target.value) },
                            }))
                          }
                          className="w-full min-w-0 text-center"
                        />
                      </TableCell>
                      <TableCell className="align-middle">
                        <Input
                          type="number"
                          min={0}
                          value={quickDraft.comision}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [quickEditKey]: { ...quickDraft, comision: Number(event.target.value) },
                            }))
                          }
                          className="w-full min-w-0 text-center"
                        />
                      </TableCell>
                      <TableCell className="align-middle">
                        <Input
                          type="number"
                          min={0}
                          value={quickDraft.gastos}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [quickEditKey]: { ...quickDraft, gastos: Number(event.target.value) },
                            }))
                          }
                          className="w-full min-w-0 text-center"
                        />
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex h-9 items-center justify-center text-sm text-foreground">
                          {formatPrice(quickDraft.price)}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={quickDraft.discount}
                          onChange={(event) =>
                            setQuickEditForm((current) => ({
                              ...current,
                              [quickEditKey]: { ...quickDraft, discount: Number(event.target.value) },
                            }))
                          }
                          className="w-full min-w-0 text-center"
                        />
                      </TableCell>
                      <TableCell className="align-middle">{formatPrice(Math.max(0, quickDraft.price * (1 - quickDraft.discount / 100)))}</TableCell>
                      <TableCell className="align-middle">
                        {formatPrice(quickDraft.price * (1 - quickDraft.discount / 100) - quickDraft.gastos)}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setConfirmState({
                                open: true,
                                title: `Guardar cambios de "${product.name}"?`,
                                description: undefined,
                                onConfirm: () => saveQuickEdit(product, variant),
                              })
                            }
                            className="h-7 flex-none gap-1 bg-transparent px-2 text-xs text-green-600 hover:bg-green-100/80 hover:text-green-700"
                          >
                            <Check className="h-3 w-3" />
                            <span className="hidden sm:inline">Guardar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelQuickEdit}
                            className="h-7 flex-none gap-1 bg-transparent px-2 text-xs text-destructive shadow-none hover:bg-destructive/10"
                          >
                            <X className="size-3" />
                            <span className="hidden sm:inline">Cancelar</span>
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2 text-left">
                          <Checkbox
                            className="shrink-0"
                            checked={selectedProductIds.includes(getProductSelectionKey(product, variant))}
                            onCheckedChange={(checked) => toggleProductSelection(getProductSelectionKey(product, variant), checked === true)}
                            aria-label={`Seleccionar ${product.name}`}
                          />
                          <span className="min-w-0 break-words font-medium">{product.name}</span>
                          {variant ? (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {variant.name}
                            </span>
                          ) : null}
                          {product.hidden ? (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">Oculto</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>{brands[product.brand].shortName}</TableCell>
                      <TableCell className="text-muted-foreground uppercase">{product.category}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            displayStock === 0
                              ? "destructive"
                              : displayStock <= 4
                                ? "warning"
                                : "success"
                          }
                        >
                          {displayStock}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatPrice(displayComision, displayComisionCurrency)}</TableCell>
                      <TableCell>{formatPrice(displayGastos, displayGastosCurrency)}</TableCell>
                      <TableCell>{formatPrice(displayPrice)}</TableCell>
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
                      <TableCell>{formatPrice(displayProfit, displayProfitCurrency)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          <label className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1 text-xs">
                            <span>{product.hidden ? "No disponible" : "Disponible"}</span>
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
                            onClick={() => startQuickEdit(product, variant)}
                            className="h-7 gap-1 px-2 text-xs"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Editar rápido</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditProductDialog(product, variant)}
                            className="h-7 gap-1 px-2 text-xs"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicateProduct(product)}
                            className="h-7 gap-1 px-2 text-xs"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Duplicar</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setConfirmState({
                                open: true,
                                title: variant ? `Eliminar variante "${variant.name}"?` : `Eliminar "${product.name}"?`,
                                description: "Esta acción no se puede deshacer.",
                                onConfirm: () => handleDeleteProduct(product.id, variant?.id),
                              })
                            }
                            aria-label={`Eliminar ${product.name}`}
                            className="h-7 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
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
                <TableCell colSpan={12} className="py-16 text-center text-sm text-muted-foreground">
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
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Mostrar</div>
          <Input
            type="number"
            min={1}
            max={1000}
            value={pageSizeInput}
            placeholder="Ej: 10"
            onChange={(e) => setPageSizeInput(e.target.value)}
            className="h-8 w-28"
          />

          {(() => {
            const v = Number(pageSizeInput);
            const isValid = Number.isFinite(v) && v >= 1;
            const isChanged = pageSizeInput !== "" && String(Math.floor(v)) !== String(pageSize);
            return (
              <Button
                size="sm"
                onClick={() => {
                  if (!isValid || !isChanged) return;
                  const final = Math.min(1000, Math.floor(v));
                  setPageSize(final);
                  setPage(0);
                }}
                disabled={!isValid || !isChanged}
              >
                <Check className="h-4 w-4 mr-2" />Confirmar
              </Button>
            );
          })()}
        </div>
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

      <input
        ref={multiProductInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          handleImportMultipleProducts(event.target.files);
          event.target.value = "";
        }}
      />

      <Dialog open={createChoiceOpen} onOpenChange={setCreateChoiceOpen}>
        <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle>Crear producto</DialogTitle>
            <DialogDescription>Elegí cómo quieres añadir nuevos productos al catálogo.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left"
              onClick={openSingleProductDialog}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>Un solo producto</span>
                <span className="text-xs text-muted-foreground">Abrir formulario</span>
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => {
                setCreateChoiceOpen(false);
                multiProductInputRef.current?.click();
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>Varios productos</span>
                <span className="text-xs text-muted-foreground">Seleccionar imágenes</span>
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => {
                setCreateChoiceOpen(false);
                toast.info("Importar desde Store aún no está implementado.");
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>Importar desde la tienda Store</span>
                <span className="text-xs text-muted-foreground">Próximamente</span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ProductEditDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        productForm={productForm}
        setProductForm={setProductForm}
        configuredUsdRate={usdRate}
        initialVariantId={null}
        bulkEditPosition={-1}
        bulkEditCount={0}
        onNavigateBulkEdit={() => {}}
        onSave={handleSaveProduct}
      />
      <ProductEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        productForm={productForm}
        setProductForm={setProductForm}
        configuredUsdRate={usdRate}
        initialVariantId={initialVariantId}
        bulkEditPosition={bulkEditQueue.length > 0 ? bulkEditPosition : -1}
        bulkEditCount={bulkEditQueue.length}
        onNavigateBulkEdit={navigateBulkEditProduct}
        onSave={handleSaveProduct}
      />
      <Dialog open={usdRatePromptOpen} onOpenChange={setUsdRatePromptOpen}>
        <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em] text-amber-700">
              Tipo de cambio
            </div>
            <DialogTitle className="text-2xl">Ingresá el valor de 1 USD</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Este valor se reutilizará automáticamente al seleccionar USD en los productos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2">
                <span className="min-w-fit text-sm font-medium text-amber-700">1 USD =</span>
                <Input
                  id="admin-usd-rate"
                  type="number"
                  min={0}
                  value={usdRatePromptValue}
                  onChange={(event) => setUsdRatePromptValue(event.target.value)}
                  placeholder="Ej: 1200"
                  className="h-11 text-base"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setUsdRatePromptOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleUsdRateConfirm}>
                Guardar valor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  mode,
  productForm,
  setProductForm,
  configuredUsdRate,
  initialVariantId,
  bulkEditPosition,
  bulkEditCount,
  onNavigateBulkEdit,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  productForm: ProductFormState | null;
  setProductForm: (form: ProductFormState | null) => void;
  configuredUsdRate: number;
  initialVariantId: string | null;
  bulkEditPosition: number;
  bulkEditCount: number;
  onNavigateBulkEdit: (direction: -1 | 1) => void;
  onSave: () => void;
}) {
  const [newFeature, setNewFeature] = useState("");
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
  const [inlineFeatureText, setInlineFeatureText] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const initialFormRef = useRef<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variantNameDraft, setVariantNameDraft] = useState("");
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [inlineVariantName, setInlineVariantName] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionConfirmed, setDescriptionConfirmed] = useState(true);
  const descriptionInitialRef = useRef("");
  const descriptionAppliedRef = useRef("");
  const featuresAppliedRef = useRef("");

  useEffect(() => {
    if (!open) {
      initialFormRef.current = null;
      return;
    }

    if (productForm) {
      initialFormRef.current = JSON.stringify(productForm);
      setSelectedVariantId(initialVariantId ?? productForm.variants[0]?.id ?? null);
    }
  }, [open, initialVariantId, productForm?.id]);

  useEffect(() => {
    if (!productForm) return;
    const selectedVariant = productForm.variants.find((variant) => variant.id === selectedVariantId);
    const description = selectedVariant?.description ?? productForm.description;
    setDescriptionDraft(description);
    setDescriptionConfirmed(true);
    descriptionInitialRef.current = description;
    descriptionAppliedRef.current = description;
    featuresAppliedRef.current = JSON.stringify(selectedVariant?.features ?? productForm.features);
  }, [open, selectedVariantId]);

  const hasChanges = useMemo(
    () => (productForm ? JSON.stringify(productForm) !== initialFormRef.current : false),
    [productForm],
  );

  const handleAddFeature = () => {
    if (!productForm) return;
    const feature = newFeature.trim();
    if (!feature) return;

    setProductForm({
      ...productForm,
      ...(activeVariant
        ? {
            variants: productForm.variants.map((variant) =>
              variant.id === activeVariant.id
                ? { ...variant, features: [...activeFeatures, feature] }
                : variant,
            ),
          }
        : { features: [...activeFeatures, feature] }),
    });
    setNewFeature("");
  };

  const handleStartInlineEdit = (index: number) => {
    if (!productForm) return;
    setEditingFeatureIndex(index);
    setInlineFeatureText(activeFeatures[index] ?? "");
  };

  const handleSaveInlineEdit = () => {
    if (!productForm || editingFeatureIndex === null) return;
    const feature = inlineFeatureText.trim();
    if (!feature) return;

    setProductForm({
      ...productForm,
      ...(activeVariant
        ? {
            variants: productForm.variants.map((variant) =>
              variant.id === activeVariant.id
                ? { ...variant, features: activeFeatures.map((item, index) => index === editingFeatureIndex ? feature : item) }
                : variant,
            ),
          }
        : { features: activeFeatures.map((item, index) => index === editingFeatureIndex ? feature : item) }),
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
      ...(activeVariant
        ? {
            variants: productForm.variants.map((variant) =>
              variant.id === activeVariant.id
                ? { ...variant, features: activeFeatures.filter((_, i) => i !== index) }
                : variant,
            ),
          }
        : { features: activeFeatures.filter((_, i) => i !== index) }),
    });
    if (editingFeatureIndex === index) {
      handleCancelInlineEdit();
    }
  };

  const [confirmDeleteFeatureOpen, setConfirmDeleteFeatureOpen] = useState(false);
  const [featureToDeleteIndex, setFeatureToDeleteIndex] = useState<number | null>(null);

  const requestUsdRateForCurrency = (field: "priceCurrency" | "comisionCurrency" | "gastosCurrency", nextCurrency: CurrencyCode) => {
    if (!productForm) return;

    setProductForm({
      ...productForm,
      [field]: nextCurrency,
      usdRate: nextCurrency === "USD" && configuredUsdRate > 0 ? configuredUsdRate : productForm.usdRate,
    });
  };

  const handleAddImageFiles = (files: FileList | null) => {
    if (!productForm || !files?.length) return;

    const imageUrls = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => URL.createObjectURL(file));
    if (!imageUrls.length) return;

    setProductForm({
      ...productForm,
      images: [...productForm.images, ...imageUrls],
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
    handleAddImageFiles(event.target.files);
    event.target.value = "";
  };

  const addVariant = () => {
    if (!productForm || !variantNameDraft.trim()) return;
    const variant: ProductVariant = {
      id: `variant-${Date.now()}`,
      name: variantNameDraft.trim(),
      price: productForm.price,
      priceCurrency: productForm.priceCurrency,
      comision: productForm.comision,
      comisionCurrency: productForm.comisionCurrency,
      gastos: productForm.gastos,
      gastosCurrency: productForm.gastosCurrency,
      description: productForm.description,
      stock: productForm.stock,
      features: productForm.features,
      deliveryUnit: productForm.deliveryUnit,
      deliveryAmount: productForm.deliveryAmount,
      discount: productForm.discount,
    };
    setProductForm({ ...productForm, variants: [...productForm.variants, variant] });
    setVariantNameDraft("");
  };

  const updateVariant = (index: number, updates: Partial<ProductVariant>) => {
    if (!productForm) return;
    setProductForm({
      ...productForm,
      variants: productForm.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, ...updates } : variant,
      ),
    });
  };

  const handleStartVariantEdit = (index: number) => {
    if (!productForm) return;
    setEditingVariantIndex(index);
    setInlineVariantName(productForm.variants[index]?.name ?? "");
  };

  const handleSaveVariantEdit = () => {
    if (editingVariantIndex === null || !inlineVariantName.trim()) return;
    updateVariant(editingVariantIndex, { name: inlineVariantName.trim() });
    setEditingVariantIndex(null);
    setInlineVariantName("");
  };

  const handleCancelVariantEdit = () => {
    setEditingVariantIndex(null);
    setInlineVariantName("");
  };

  const removeVariant = (index: number) => {
    if (!productForm) return;
    const removedVariant = productForm.variants[index];
    setProductForm({
      ...productForm,
      variants: productForm.variants.filter((_, variantIndex) => variantIndex !== index),
    });
    if (removedVariant?.id === selectedVariantId) {
      setSelectedVariantId(productForm.variants[index + 1]?.id ?? productForm.variants[index - 1]?.id ?? null);
    }
    if (editingVariantIndex === index) handleCancelVariantEdit();
  };

  const activeVariant = productForm?.variants.find((variant) => variant.id === selectedVariantId);
  const activeFeatures = activeVariant?.features ?? productForm?.features ?? [];
  const updateActiveVariant = (updates: Partial<ProductVariant>) => {
    if (!productForm) return;
    if (!activeVariant) {
      setProductForm({ ...productForm, ...updates });
      return;
    }
    setProductForm({
      ...productForm,
      variants: productForm.variants.map((variant) =>
        variant.id === activeVariant.id ? { ...variant, ...updates } : variant,
      ),
    });
  };

  const applyDescriptionToAllVariants = () => {
    if (!productForm || !activeVariant) return;
    setProductForm({
      ...productForm,
      variants: productForm.variants.map((variant) => ({
        ...variant,
        description: descriptionDraft,
      })),
    });
    descriptionAppliedRef.current = descriptionDraft;
    toast.success("Descripción aplicada a todas las variantes");
  };

  const applyFeaturesToAllVariants = () => {
    if (!productForm || !activeVariant) return;
    setProductForm({
      ...productForm,
      variants: productForm.variants.map((variant) => ({
        ...variant,
        features: [...activeFeatures],
      })),
    });
    featuresAppliedRef.current = JSON.stringify(activeFeatures);
    toast.success("Características aplicadas a todas las variantes");
  };

  const canApplyDescription =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    descriptionConfirmed &&
    descriptionDraft !== descriptionAppliedRef.current;
  const canApplyFeatures =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    JSON.stringify(activeFeatures) !== featuresAppliedRef.current;

  const confirmDescription = () => {
    if (!productForm || descriptionDraft === descriptionInitialRef.current) return;
    updateActiveVariant({ description: descriptionDraft });
    setDescriptionConfirmed(true);
    descriptionInitialRef.current = descriptionDraft;
  };

  if (!productForm) return null;

  const isNewProduct = mode === "create";
  const modeTitle = isNewProduct ? "Nuevo producto" : "Editar producto";
  const modeDescription = isNewProduct
    ? "Agregá un producto completo con nombre, stock, precio y categoría."
    : "Actualizá los datos del producto sin afectar el flujo de alta.";
  const availableCategories = productForm.brand
    ? brands[productForm.brand].categories.map((category) => ({
        ...category,
        brandSlug: productForm.brand,
        brandName: brands[productForm.brand].name,
      }))
    : brandList.flatMap((brand) =>
        brand.categories.map((category) => ({
          ...category,
          brandSlug: brand.slug,
          brandName: brand.name,
        })),
      );
  const usdRate = productForm.usdRate > 0 ? productForm.usdRate : 0;
  const toLocalCurrency = (amount: number, currency: CurrencyCode) =>
    currency === "USD" ? (usdRate > 0 ? amount * usdRate : 0) : amount;
  const precioEnLocal = toLocalCurrency(productForm.price, productForm.priceCurrency);
  const gastosEnLocal = toLocalCurrency(productForm.gastos, productForm.gastosCurrency);
  const precioConDescuento = precioEnLocal * (1 - productForm.discount / 100);
  const ganancias = precioConDescuento - gastosEnLocal;
  const formatLockedNumber = (value: number) =>
    new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 0,
    }).format(value);
  const isImmediate = productForm.deliveryUnit === "inmediata";
  const priceValue = String(productForm.price);
  const gastosValue = String(productForm.gastos);
  const discountValue = String(productForm.discount);
  const comisionValue = String(productForm.comision);
  const stockValue = String(productForm.stock);
  const deliveryAmountValue = String(productForm.deliveryAmount);
  const conversionHint =
    usdRate > 0 ? `Tipo de cambio USD: 1 USD = ${formatPrice(usdRate)}` : "Ingresá el valor de 1 USD para convertir";
  const showUsdRateInput = productForm.priceCurrency === "USD" || productForm.comisionCurrency === "USD" || productForm.gastosCurrency === "USD";
  const activeCommission = activeVariant?.comision ?? productForm.comision;
  const activeCommissionCurrency = activeVariant?.comisionCurrency ?? productForm.comisionCurrency;
  const activeExpenses = activeVariant?.gastos ?? productForm.gastos;
  const activeExpensesCurrency = activeVariant?.gastosCurrency ?? productForm.gastosCurrency;
  const activeDiscount = activeVariant?.discount ?? productForm.discount;
  const activeStock = activeVariant?.stock ?? productForm.stock;
  const activeDeliveryUnit = activeVariant?.deliveryUnit ?? productForm.deliveryUnit;
  const activeDeliveryAmount = activeVariant?.deliveryAmount ?? productForm.deliveryAmount;
  const showsDeliveryDetails = activeDeliveryUnit === "horas" || activeDeliveryUnit === "dias";
  const activePriceCurrency = activeVariant?.priceCurrency ?? productForm.priceCurrency;
  const samePricingCurrency = activeCommissionCurrency === activeExpensesCurrency;
  const activeOutputCurrency = samePricingCurrency ? activeCommissionCurrency : "ARS";
  const activeCommissionValue = samePricingCurrency
    ? activeCommission
    : toLocalCurrency(activeCommission, activeCommissionCurrency);
  const activeExpensesValue = samePricingCurrency
    ? activeExpenses
    : toLocalCurrency(activeExpenses, activeExpensesCurrency);
  const activePriceValue = activeCommissionValue + activeExpensesValue;
  const activeStorePrice = activePriceValue * (1 - activeDiscount / 100);
  const activeProfit = activeStorePrice - activeExpensesValue;
  const activeUsdRequired = activeCommissionCurrency === "USD" || activeExpensesCurrency === "USD";
  const hasBulkNavigation = bulkEditCount > 1;
  const canNavigatePrevious = bulkEditPosition > 0;
  const canNavigateNext = hasBulkNavigation && bulkEditPosition < bulkEditCount - 1;
  const updateActivePricing = (updates: Partial<ProductVariant>) => {
    if (!productForm) return;
    if (!activeVariant) {
      const next = { ...productForm, ...updates } as ProductFormState;
      const commissionLocal = toLocalCurrency(next.comision, next.comisionCurrency);
      const expensesLocal = toLocalCurrency(next.gastos, next.gastosCurrency);
      setProductForm({ ...next, price: commissionLocal + expensesLocal, priceCurrency: "ARS" });
      return;
    }
    const nextVariant = { ...activeVariant, ...updates };
    const commissionLocal = toLocalCurrency(nextVariant.comision ?? 0, nextVariant.comisionCurrency ?? "ARS");
    const expensesLocal = toLocalCurrency(nextVariant.gastos ?? 0, nextVariant.gastosCurrency ?? "ARS");
    setProductForm({
      ...productForm,
      variants: productForm.variants.map((variant) =>
        variant.id === activeVariant.id
          ? { ...nextVariant, price: commissionLocal + expensesLocal, priceCurrency: "ARS" }
          : variant,
      ),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border border-border/60 bg-background p-5 shadow-2xl sm:max-w-4xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{modeTitle}</DialogTitle>
            {hasBulkNavigation ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button type="button" variant="outline" size="sm" onClick={() => onNavigateBulkEdit(-1)} disabled={!canNavigatePrevious} aria-label="Producto anterior">
                  <ArrowLeft className="size-4" /> Anterior
                </Button>
                <span>{bulkEditPosition + 1} / {bulkEditCount}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => onNavigateBulkEdit(1)} disabled={!canNavigateNext} aria-label="Producto siguiente">
                  Siguiente <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <DialogDescription>{modeDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="order-1 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {isNewProduct ? "Alta" : "Edición"}
              </span>
              {productForm.id ? (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
                  ID {productForm.id}
                </span>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Nombre</Label>
                <Input
                  id="new-name"
                  value={productForm.name}
                  onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-sector">Tienda</Label>
                <Select
                  value={productForm.brand}
                  onValueChange={(value) => {
                    const nextBrand = value as BrandSlug;

                    setProductForm({
                      ...productForm,
                      brand: nextBrand,
                      category: "",
                    });
                  }}
                >
                  <SelectTrigger id="new-sector" className="w-full">
                    <SelectValue placeholder="Seleccionar tienda" />
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
                  onValueChange={(value) => {
                    const selectedCategory = availableCategories.find((category) => category.slug === value);
                    setProductForm({
                      ...productForm,
                      brand: productForm.brand || selectedCategory?.brandSlug || "",
                      category: value,
                    });
                  }}
                >
                  <SelectTrigger id="new-category" className="w-full">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.slug} value={category.slug}>
                        {productForm.brand ? category.name : `${category.name} (${category.brandName})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {false && (<>
              {showUsdRateInput ? (
                <div className="h-full space-y-2 sm:col-span-2">
                  <Label htmlFor="usd-rate">Tipo de cambio USD</Label>
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <span className="min-w-fit text-[10px] font-medium uppercase tracking-[0.2em] text-amber-600">
                        1 USD =
                      </span>
                      <Input
                        id="usd-rate"
                        type="number"
                        min={0}
                        value={usdRate === 0 ? "" : String(usdRate)}
                        placeholder="Ej: 1200"
                        disabled
                        className="h-9 cursor-not-allowed opacity-70"
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{conversionHint}</p>
                  </div>
                </div>
              ) : null}

              <div className="h-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="new-price">Precio</Label>
                  <Select
                    value={productForm.priceCurrency}
                    onValueChange={(value) =>
                      requestUsdRateForCurrency("priceCurrency", value as CurrencyCode)
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">$ (ARS)</SelectItem>
                      <SelectItem value="USD">USD (Dólar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                {productForm.priceCurrency === "USD" ? (
                  <p className="text-[11px] text-muted-foreground">
                    {conversionHint} · equivale a {formatPrice(precioEnLocal)}
                  </p>
                ) : null}
              </div>

              <div className="h-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="new-comision">Mi comisión</Label>
                  <Select
                    value={productForm.comisionCurrency}
                    onValueChange={(value) =>
                      requestUsdRateForCurrency("comisionCurrency", value as CurrencyCode)
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">$ (ARS)</SelectItem>
                      <SelectItem value="USD">USD (Dólar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  id="new-comision"
                  type="number"
                  min={0}
                  value={comisionValue}
                  onFocus={(event) => event.target.select()}
                  onChange={(event) =>
                    setProductForm({ ...productForm, comision: Number(event.target.value) })
                  }
                  placeholder="Mi comisión"
                />
              </div>

              <div className="h-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="new-gastos">Gastos</Label>
                  <Select
                    value={productForm.gastosCurrency}
                    onValueChange={(value) =>
                      requestUsdRateForCurrency("gastosCurrency", value as CurrencyCode)
                    }
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">$ (ARS)</SelectItem>
                      <SelectItem value="USD">USD (Dólar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                {productForm.gastosCurrency === "USD" ? (
                  <p className="text-[11px] text-muted-foreground">
                    {conversionHint} · equivale a {formatPrice(gastosEnLocal)}
                  </p>
                ) : null}
              </div>

              <div className="h-full space-y-2">
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

              <div className="h-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Precio en la tienda</Label>
                  <span className="rounded-md border border-input bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {productForm.priceCurrency}
                  </span>
                </div>
                <div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm text-foreground opacity-80">
                  {formatLockedNumber(precioConDescuento)}
                </div>
              </div>

              <div className="h-full space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Ganancias</Label>
                  <span className="rounded-md border border-input bg-muted/30 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    {productForm.priceCurrency}
                  </span>
                </div>
                <div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm text-foreground opacity-80">
                  {ganancias >= 0
                    ? formatLockedNumber(ganancias)
                    : `-${formatLockedNumber(Math.abs(ganancias))}`}
                </div>
              </div>

              <div className="h-full space-y-2">
                <Label htmlFor="delivery-unit">Tiempo de entrega</Label>
                <Select
                  value={productForm.deliveryUnit}
                  onValueChange={(value) =>
                    setProductForm({ ...productForm, deliveryUnit: value as DeliveryUnit })
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

              {!isImmediate && (
                <div className="h-full space-y-2">
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
                  />
                </div>
              )}

              {!isImmediate && (
                <div className="h-full space-y-2">
                  <Label>Entrega</Label>
                  <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-foreground opacity-60">
                    {`${productForm.deliveryAmount} ${productForm.deliveryUnit}`}
                  </div>
                </div>
              )}

              <div className="h-full space-y-2">
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
              </>)}
            </div>
          </div>

          <div className="order-3 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">Precios</span>
              <Select value={selectedVariantId ?? "base"} onValueChange={(value) => setSelectedVariantId(value === "base" ? null : value)}>
                <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Elegir variante" /></SelectTrigger>
                <SelectContent>
                  {!productForm.variants.length && <SelectItem value="base">Producto base</SelectItem>}
                  {productForm.variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {activeUsdRequired && <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/5 p-3 text-xs text-muted-foreground">{conversionHint}</div>}
            <div className="grid items-start gap-4 sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1"><div className="flex min-h-8 items-center justify-between gap-2"><Label>Mi comisión</Label><Select value={activeCommissionCurrency} onValueChange={(value) => updateActivePricing({ comisionCurrency: value as CurrencyCode })}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">$ (ARS)</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div><Input type="number" min={0} value={isNewProduct && activeCommission === 0 ? "" : activeCommission} onChange={(event) => updateActivePricing({ comision: Number(event.target.value) || 0 })} /></div>
              <div className="flex min-w-0 flex-col gap-1"><div className="flex min-h-8 items-center justify-between gap-2"><Label>Gastos</Label><Select value={activeExpensesCurrency} onValueChange={(value) => updateActivePricing({ gastosCurrency: value as CurrencyCode })}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ARS">$ (ARS)</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div><Input type="number" min={0} value={isNewProduct && activeExpenses === 0 ? "" : activeExpenses} onChange={(event) => updateActivePricing({ gastos: Number(event.target.value) || 0 })} /></div>
              <div className="flex min-w-0 flex-col gap-1"><div className="flex min-h-8 items-center justify-between gap-2"><Label>Precio</Label><span className="text-xs text-muted-foreground">{activeOutputCurrency}</span></div><div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm opacity-80">{formatLockedNumber(activePriceValue)}</div></div>
            </div>
            <div className="mt-4 grid items-start gap-4 sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1"><Label className="min-h-8">Descuento (%)</Label><Input type="number" min={0} max={100} value={isNewProduct && activeDiscount === 0 ? "" : activeDiscount} onChange={(event) => updateActiveVariant({ discount: Number(event.target.value) || 0 })} /></div>
              <div className="flex min-w-0 flex-col gap-1"><div className="flex min-h-8 items-center justify-between gap-2"><Label>Precio tienda</Label><span className="text-xs text-muted-foreground">{activeOutputCurrency}</span></div><div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm opacity-80">{formatLockedNumber(activeStorePrice)}</div></div>
              <div className="flex min-w-0 flex-col gap-1"><div className="flex min-h-8 items-center justify-between gap-2"><Label>Ganancias</Label><span className="text-xs text-muted-foreground">{activeOutputCurrency}</span></div><div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm opacity-80">{formatLockedNumber(activeProfit)}</div></div>
            </div>
            <div className={`mt-4 grid items-start gap-4 ${showsDeliveryDetails ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
              <div className="flex min-w-0 flex-col gap-1"><Label className="min-h-8">Stock</Label><Input type="number" min={0} value={isNewProduct && activeStock === 0 ? "" : activeStock} onChange={(event) => updateActiveVariant({ stock: Number(event.target.value) || 0 })} /></div>
              <div className="flex min-w-0 flex-col gap-1"><Label className="min-h-8">Tiempo de entrega</Label><Select value={activeDeliveryUnit} onValueChange={(value) => updateActiveVariant({ deliveryUnit: value as DeliveryUnit })}><SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger><SelectContent><SelectItem value="inmediata">Entrega inmediata</SelectItem><SelectItem value="horas">Horas</SelectItem><SelectItem value="dias">Días</SelectItem></SelectContent></Select></div>
              {showsDeliveryDetails && <><div className="flex min-w-0 flex-col gap-1"><Label className="min-h-8">Cantidad</Label><Input type="number" min={1} value={activeDeliveryAmount === 0 ? "" : activeDeliveryAmount} onChange={(event) => updateActiveVariant({ deliveryAmount: Number(event.target.value) || 0 })} /></div><div className="flex min-w-0 flex-col gap-1"><Label className="min-h-8">Entrega</Label><div className="flex h-9 items-center rounded-md border border-input px-3 text-sm opacity-60">{activeDeliveryAmount > 0 ? `${activeDeliveryAmount} ${activeDeliveryUnit}` : ""}</div></div></>}
            </div>
          </div>

          <div className="order-2 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Variantes
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  value={variantNameDraft}
                  onChange={(event) => setVariantNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addVariant();
                    }
                  }}
                  placeholder="Escribir nueva variante"
                />
                <Button type="button" onClick={addVariant} className="whitespace-nowrap">
                  <Plus className="h-4 w-4" /> Agregar
                </Button>
              </div>

              {productForm.variants.length > 0 && (
                <div className="space-y-2">
                {productForm.variants.map((variant, index) => (
                  <div key={variant.id} className="flex items-center justify-between gap-2 rounded-xl border border-input p-3">
                    {editingVariantIndex === index ? (
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                        <Input
                          value={inlineVariantName}
                          onChange={(event) => setInlineVariantName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleSaveVariantEdit();
                            }
                          }}
                          className="min-w-0 flex-1"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!inlineVariantName.trim() || inlineVariantName.trim() === variant.name}
                            className="h-8 gap-2 px-3 text-sm text-green-600 hover:bg-green-100/80 hover:text-green-700"
                            onClick={handleSaveVariantEdit}
                          >
                            <Check className="size-4" /> Guardar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                            onClick={handleCancelVariantEdit}
                          >
                            <X className="size-4" /> Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <button type="button" className="min-w-0 truncate text-left text-sm font-medium" onClick={() => setSelectedVariantId(variant.id)}>
                            {variant.name}
                          </button>
                          {selectedVariantId === variant.id && <Badge className="shrink-0 border-emerald-300 bg-emerald-500 text-black">Activa</Badge>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button type="button" variant={selectedVariantId === variant.id ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedVariantId(variant.id)} className="h-8 gap-2 px-3 text-sm" disabled={selectedVariantId === variant.id}>
                            {selectedVariantId === variant.id ? "Seleccionado" : "Seleccionar"}
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleStartVariantEdit(index)} className="h-8 gap-2 px-3 text-sm">
                            <Pencil className="size-4" /> Editar
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(index)} className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10">
                            <Trash2 className="size-4" /> Eliminar
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                </div>
              )}
            </div>
          </div>

          <div className="order-3 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Proveedores
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="flex min-w-0 flex-col gap-1">
                <Label>Nombre</Label>
                <Input value={productForm.supplier.name} onChange={(event) => setProductForm({ ...productForm, supplier: { ...productForm.supplier, name: event.target.value } })} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Label>Celular</Label>
                <Input value={productForm.supplier.phone} onChange={(event) => setProductForm({ ...productForm, supplier: { ...productForm.supplier, phone: event.target.value } })} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Label>Red social</Label>
                <Input value={productForm.supplier.social} onChange={(event) => setProductForm({ ...productForm, supplier: { ...productForm.supplier, social: event.target.value } })} />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Label>Fecha de compra</Label>
                <Input type="date" value={productForm.supplier.purchaseDate} onChange={(event) => setProductForm({ ...productForm, supplier: { ...productForm.supplier, purchaseDate: event.target.value } })} className="[&::-webkit-calendar-picker-indicator]:invert" />
              </div>
            </div>
          </div>

          <div className="order-4 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Características
              </span>
              <Select value={selectedVariantId ?? "base"} onValueChange={(value) => setSelectedVariantId(value === "base" ? null : value)}>
                <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Elegir variante" /></SelectTrigger>
                <SelectContent>
                  {!productForm.variants.length && <SelectItem value="base">Producto base</SelectItem>}
                  {productForm.variants.map((variant) => <SelectItem key={variant.id} value={variant.id}>{variant.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
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

              {activeFeatures.length > 0 && (
                <div className="grid gap-2">
                  {activeFeatures.map((feature, index) => (
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
                              variant="ghost"
                              size="sm"
                              disabled={
                                inlineFeatureText.trim() === (activeFeatures[editingFeatureIndex] ?? "") ||
                                !inlineFeatureText.trim()
                              }
                              className="h-8 gap-2 px-3 text-sm text-green-600 hover:text-green-700 bg-transparent hover:bg-green-100/80"
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
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={applyFeaturesToAllVariants}
                disabled={!canApplyFeatures}
                className="text-sm"
              >
                <Check className="mr-2 size-3.5" />
                Aplicar a todos
              </Button>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={descriptionDraft}
                  rows={3}
                  onChange={(event) => {
                    setDescriptionDraft(event.target.value);
                    setDescriptionConfirmed(false);
                  }}
                  placeholder="Descripción de esta variante"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={confirmDescription}
                    disabled={descriptionDraft === descriptionInitialRef.current}
                    className="text-sm"
                  >
                    <Check className="mr-2 size-3.5" />
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={applyDescriptionToAllVariants}
                    disabled={!canApplyDescription}
                    className="text-sm"
                  >
                    <Check className="mr-2 size-3.5" />
                    Aplicar a todos
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="order-5 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Imágenes
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="relative">
                  <Input
                    id="new-image"
                    type="file"
                    accept="image/*"
                    multiple
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
        </div>

        <ConfirmDialog
          open={confirmDeleteFeatureOpen}
          onOpenChange={(open) => setConfirmDeleteFeatureOpen(open)}
          title={
            featureToDeleteIndex !== null
              ? `Eliminar "${activeFeatures[featureToDeleteIndex]}"?`
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
                variant="secondary"
                onClick={() => {
                  if (hasChanges) {
                    setConfirmExitOpen(true);
                  } else {
                    setProductForm(null);
                    onOpenChange(false);
                  }
                }}
                className="rounded-md border border-transparent bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80 hover:text-secondary-foreground hover:shadow-none"
                style={{ boxShadow: "none" }}
              >
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button
                variant="default"
                disabled={!hasChanges}
                onClick={() => setConfirmSaveOpen(true)}
                className="rounded-md border border-transparent bg-primary text-primary-foreground shadow-none hover:bg-primary/90 hover:text-primary-foreground hover:shadow-none disabled:opacity-50"
                style={{ boxShadow: "none" }}
              >
                <Save className="h-4 w-4 mr-2" />
                {isNewProduct ? "Guardar producto" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </DialogFooter>

              {hasBulkNavigation ? (
                <div className="mr-auto flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onNavigateBulkEdit(-1)} disabled={!canNavigatePrevious} aria-label="Producto anterior">
                    <ArrowLeft className="size-4" /> Anterior
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => onNavigateBulkEdit(1)} disabled={!canNavigateNext} aria-label="Producto siguiente">
                    Siguiente <ArrowRight className="size-4" />
                  </Button>
                </div>
              ) : null}
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
