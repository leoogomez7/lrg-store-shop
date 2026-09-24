import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Pencil,
  Plus,
  Save,
  Search,
  Sheet,
  Trash2,
  X,
  Copy,
  ArrowUpDown,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  products as productsData,
  saveProducts,
  type ProductSupplier,
  type ProductVariant,
} from "@/data/products";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { FilterChipList, type FilterChipItem } from "@/components/product/product-filters";
import { cropImageDataUrl } from "@/lib/image-processing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { cn } from "@/lib/utils";
import { catalogQueries, type Product } from "@/services/catalog.service";
import { moveToTrash } from "@/data/trash";
import { loadAdminSettings, saveAdminSetting } from "@/server/persistence";

type DeliveryUnit = "inmediata" | "horas" | "dias";
type CurrencyCode = "ARS" | "USD";
type CategoryLabelNode = {
  slug: string;
  name: string;
  children?: CategoryLabelNode[];
};
type ProductFormState = {
  id: string;
  name: string;
  brand: BrandSlug | "";
  category: string;
  subcategory: string;
  price: number;
  priceCurrency: CurrencyCode;
  comision: number;
  comisionCurrency: CurrencyCode;
  stock: number;
  stockUnlimited: boolean;
  description: string;
  features: string[];
  includes: string[];
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

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo convertir la imagen seleccionada a datos persistibles."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });

const getSupplierKey = (supplier: ProductSupplier) =>
  [supplier.name, supplier.phone, supplier.social].map((value) => value.trim()).join("|");
const DELETED_SUPPLIERS_STORAGE_KEY = "lrg:deletedSuppliers";

const getBrandShortName = (brand: Product["brand"] | string | undefined) => {
  const brandKey = typeof brand === "string" ? brand : undefined;
  const brandConfig = brandKey ? brands[brandKey as BrandSlug] : undefined;

  if (brandConfig?.shortName) return brandConfig.shortName;
  if (brandKey) return brandKey;
  return "Sin marca";
};

export const Route = createFileRoute("/admin/productos")({
  head: () => ({
    meta: [
      { title: "Administrador" },
      {
        name: "description",
        content: "Administrá el catálogo completo: precios, stock y categorías por tienda.",
      },
      { property: "og:title", content: "Administrador" },
      { property: "og:description", content: "Gestión de catálogo del negocio LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminProducts,
});

function AdminProducts() {
  const queryClient = useQueryClient();
  const { data: products } = useSuspenseQuery(catalogQueries.allAdmin());
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
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [createChoiceOpen, setCreateChoiceOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkEditQueue, setBulkEditQueue] = useState<string[]>([]);
  const [bulkQuickEditQueue, setBulkQuickEditQueue] = useState<string[]>([]);
  const [bulkEditPosition, setBulkEditPosition] = useState(0);
  const bulkEditQueueRef = useRef<string[]>([]);
  const bulkEditPositionRef = useRef(0);
  const [initialVariantId, setInitialVariantId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [usdRate, setUsdRate] = useState<number>(() => {
    return 0;
  });
  const [usdRatePromptOpen, setUsdRatePromptOpen] = useState(false);
  const [usdRatePromptValue, setUsdRatePromptValue] = useState("");
  const multiProductInputRef = useRef<HTMLInputElement | null>(null);
  const textProductInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImportedProducts, setPendingImportedProducts] = useState<Product[]>([]);
  const [importCategoryOpen, setImportCategoryOpen] = useState(false);
  const [importBrand, setImportBrand] = useState<BrandSlug>("arcade");
  const [importCategory, setImportCategory] = useState("");
  const [importSubcategory, setImportSubcategory] = useState("");
  const [quickEditProductId, setQuickEditProductId] = useState<string | null>(null);
  const [quickEditVariantId, setQuickEditVariantId] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminSettings({ data: {} }).then((settings) => {
      const stored = settings.find((setting) => setting.settingKey === "lrg:usdRate");
      if (stored) setUsdRate(Number(stored.settingValue) || 0);
    });
  }, []);
  const [quickEditForm, setQuickEditForm] = useState<
    Record<
      string,
      {
        brand: BrandSlug;
        name: string;
        variantName: string;
        category: string;
        price: number;
        comision: number;
        comisionCurrency: CurrencyCode;
        gastos: number;
        gastosCurrency: CurrencyCode;
        stock: number;
        discount: number;
      }
    >
  >({});
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const [page, setPage] = useState(0);
  // `pageSize` is the confirmed page size; default is 10 products per page
  const [pageSize, setPageSize] = useState<number>(10);
  // `pageSizeInput` is the editable input value the user types before confirming
  const [pageSizeInput, setPageSizeInput] = useState<string>("10");

  const priceLimit = useMemo(() => {
    const values = products
      .filter(
        (product) =>
          !currencyFilter.length || currencyFilter.includes(product.priceCurrency ?? "ARS"),
      )
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
    confirmLabel?: string;
    cancelLabel?: string;
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
    subcategory: "",
    price: 0,
    priceCurrency: "ARS",
    comision: 0,
    comisionCurrency: "ARS",
    stock: 0,
    stockUnlimited: false,
    description: "",
    features: [],
    includes: [],
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

  const handleUsdRateConfirm = async () => {
    const nextUsdRate = Number(usdRatePromptValue);
    if (!Number.isFinite(nextUsdRate) || nextUsdRate <= 0) {
      toast.error("Ingresá un valor mayor a 0 para 1 USD.");
      return;
    }
    try {
      const saved = await saveAdminSetting({
        data: { settingKey: "lrg:usdRate", settingValue: String(nextUsdRate) },
      });
      if (!saved) {
        toast.error("No se pudo guardar el tipo de cambio en Turso.");
        return;
      }
      setUsdRate(nextUsdRate);
      setProductForm((current) => (current ? { ...current, usdRate: nextUsdRate } : current));
      setUsdRatePromptOpen(false);
      setUsdRatePromptValue("");
      toast.success("Tipo de cambio guardado");
    } catch (error) {
      console.error("Error guardando el tipo de cambio:", error);
      toast.error("No se pudo guardar el tipo de cambio en Turso.");
    }
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

  const parseTextImportProducts = async (file: File) => {
    const parseEntriesFromText = (rawText: string) => {
      const normalized = rawText
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .replace(/[–—-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!normalized) return [] as Array<{ name: string; price: number }>;

      const entries: Array<{ name: string; price: number }> = [];
      const lines = normalized
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const lineValue = line.trim();
        if (!lineValue || lineValue.length < 3) continue;

        const priceMatch = [...lineValue.matchAll(/(\d{1,3}(?:[.,]\d{1,2})?)/g)]
          .map((match) => match[1] ?? "")
          .find((value) => {
            const normalizedValue = value.trim();
            return normalizedValue.length > 0 && Number(normalizedValue.replace(",", ".")) > 0;
          });

        if (!priceMatch) continue;

        const priceValue = Number(priceMatch.replace(",", "."));
        if (!Number.isFinite(priceValue) || priceValue <= 0) continue;

        const beforePrice = lineValue.slice(0, lineValue.indexOf(priceMatch)).trim();
        const afterPrice = lineValue
          .slice(lineValue.indexOf(priceMatch) + priceMatch.length)
          .trim();
        const candidateName =
          [beforePrice, afterPrice]
            .filter(Boolean)
            .find((part) => part.length >= 3 && !/^\d+$/.test(part)) ?? beforePrice;

        const cleanedName = (candidateName ?? "")
          .replace(/^(?:producto|item|articulo|artículo|precio|price|valor|total|importe)\s+/i, "")
          .replace(/^[\s|:;,.()-]+|[\s|:;,.()-]+$/g, "")
          .replace(/[^\p{L}\p{N}\s&()/%-]/gu, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (!cleanedName || cleanedName.length < 3 || cleanedName.length > 140) continue;

        entries.push({ name: cleanedName, price: priceValue });
      }

      if (entries.length === 0) {
        const fallbackMatch = normalized.match(
          /([A-Za-zÁÉÍÓÚáéíóúñÑ0-9][^\n]{2,100})\s*(?:[:-]|\s)(\d{1,3}(?:[.,]\d{1,2})?)/,
        );
        if (!fallbackMatch) return [];
        const candidateName = (fallbackMatch[1] ?? "")
          .replace(/(?:precio|price|valor|total|importe|ars|usd|\$|€)\s*[:=-]*/gi, "")
          .replace(/^[\s|\-:;,.]+|[\s|\-:;,.]+$/g, "")
          .trim();
        const candidatePriceText = fallbackMatch[2] ?? "";
        const candidatePrice = Number(candidatePriceText.replace(",", "."));
        if (!candidateName || !Number.isFinite(candidatePrice) || candidatePrice <= 0) return [];
        return [{ name: candidateName, price: candidatePrice }];
      }

      return entries.filter(
        (entry, index, arr) =>
          arr.findIndex(
            (candidate) =>
              candidate.name.toLowerCase() === entry.name.toLowerCase() &&
              candidate.price === entry.price,
          ) === index,
      );
    };

    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const rowsFromExcel: string[] = [];

      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) return;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][];
        rows.forEach((row) => {
          const normalizedRow = row
            .map((cell) => String(cell ?? "").trim())
            .filter(Boolean)
            .join(" | ");
          if (normalizedRow) rowsFromExcel.push(normalizedRow);
        });
      });

      return parseEntriesFromText(rowsFromExcel.join("\n"));
    }

    const textContent = await file.text();
    return parseEntriesFromText(textContent);
  };

  const handleImportTextProduct = async (file: File | null) => {
    if (!file) return;

    const parsedProducts = await parseTextImportProducts(file);
    if (!parsedProducts.length) {
      toast.error("No pude detectar un nombre y un precio válidos en el archivo.");
      return;
    }

    const defaultBrand: BrandSlug = "arcade";
    const defaultCategory = brands[defaultBrand].categories[0]?.slug ?? "consolas";

    const importedProducts = parsedProducts.map(({ name, price }, index) => {
      const slugBase =
        name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || `producto-importado-${Date.now()}-${index + 1}`;

      const importedBrand: BrandSlug = defaultBrand;

      return {
        id: `import-text-${Date.now()}-${index + 1}`,
        slug: `${slugBase}-${index + 1}`,
        brand: importedBrand,
        name,
        category: defaultCategory,
        price,
        priceCurrency: "ARS",
        stock: 1,
        rating: 0,
        reviews: 0,
        short: "Producto creado desde archivo de texto.",
        description:
          "Producto generado automáticamente a partir del contenido del archivo cargado.",
        features: [],
        images: [],
        createdAt: new Date().toISOString().slice(0, 10),
      } as Product;
    });

    setCreateChoiceOpen(false);
    setPendingImportedProducts(importedProducts);
    setImportBrand("arcade");
    setImportCategory(defaultCategory);
    setImportSubcategory("");
    setImportCategoryOpen(true);
  };

  const handleImportMultipleProducts = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      toast.error("No se seleccionaron imágenes válidas.");
      return;
    }

    const imageDataUrls = await Promise.all(
      imageFiles.map(async (file) => cropImageDataUrl(await fileToDataUrl(file))),
    );

    const importedProducts = imageFiles.map((file, index) => {
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const productName = baseName || `Producto importado ${index + 1}`;
      const slugBase =
        productName
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
        images: [imageDataUrls[index]],
        createdAt: new Date().toISOString().slice(0, 10),
      } as Product;
    });

    setCreateChoiceOpen(false);
    setPendingImportedProducts(importedProducts);
    setImportBrand("arcade");
    setImportCategory(brands.arcade.categories[0]?.slug ?? "consolas");
    setImportSubcategory("");
    setImportCategoryOpen(true);
  };

  const importCategories = brands[importBrand].categories;
  const selectedImportCategory = importCategories.find(
    (category) => category.slug === importCategory,
  );

  const handleConfirmMultipleImport = () => {
    if (!pendingImportedProducts.length || !importCategory) return;

    const importedProducts = pendingImportedProducts.map((product) => ({
      ...product,
      brand: importBrand,
      category: importCategory,
      subcategory: importSubcategory || undefined,
    }));
    (productsData as Product[]).push(...importedProducts);
    saveProducts(productsData as Product[]);
    setEditableProducts((current) => [...current, ...importedProducts]);
    setPendingImportedProducts([]);
    setImportCategoryOpen(false);
    toast.success(`Se importaron ${importedProducts.length} productos`, {
      description:
        "Ya están disponibles en el listado y puedes editarlos como cualquier otro producto.",
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
      subcategory: product.subcategory ?? "",
      price: product.price,
      priceCurrency: product.priceCurrency ?? "ARS",
      comision: product.comision ?? 0,
      comisionCurrency: product.comisionCurrency ?? "ARS",
      stock: product.stock,
      stockUnlimited: product.stockUnlimited ?? false,
      description: product.description,
      features: product.features ?? [],
      includes: product.includes ?? [],
      images: product.images ?? [],
      gastos: product.gastos ?? 0,
      gastosCurrency: product.gastosCurrency ?? "ARS",
      usdRate: product.usdRate && product.usdRate > 0 ? product.usdRate : usdRate,
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

  const handleDeleteProduct = async (productId: string, variantId?: string) => {
    const product = (productsData as Product[]).find((item) => item.id === productId);
    if (product && variantId) {
      const remainingVariants = (product.variants ?? []).filter(
        (variant) => variant.id !== variantId,
      );
      product.variants = remainingVariants;

      if (remainingVariants.length === 0) {
        if (product) moveToTrash({ type: "producto", id: product.id, item: product });
        setEditableProducts((current) => current.filter((item) => item.id !== productId));
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

        const productIndex = (productsData as Product[]).findIndex((item) => item.id === productId);
        if (productIndex !== -1) {
          (productsData as Product[]).splice(productIndex, 1);
          await saveProducts(productsData as Product[]);
        }
        return;
      }

      setEditableProducts((current) =>
        current.map((currentProduct) =>
          currentProduct.id === productId
            ? { ...currentProduct, variants: remainingVariants }
            : currentProduct,
        ),
      );
      await saveProducts(productsData as Product[]);
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

    const productIndex = (productsData as Product[]).findIndex(
      (product) => product.id === productId,
    );
    if (productIndex !== -1) {
      (productsData as Product[]).splice(productIndex, 1);
      await saveProducts(productsData as Product[]);
    }
  };

  const handleDuplicateProduct = (product: Product) => {
    const newId = `${product.id}-copy-${Date.now()}`;
    const newSlug = `${product.slug}-copy-${Date.now()}`
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/--+/g, "-");
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

  const handleToggleHidden = (productId: string, variantId?: string) => {
    const nextProducts = (productsData as Product[]).map((product) => {
      if (product.id !== productId) return product;
      if (variantId) {
        if (!product.variants?.length) return product;
        return {
          ...product,
          variants: product.variants.map((variant) =>
            variant.id === variantId ? { ...variant, hidden: !variant.hidden } : variant,
          ),
        };
      }
      return { ...product, hidden: !product.hidden };
    });

    productsData.splice(0, productsData.length, ...nextProducts);
    setEditableProducts(nextProducts);
    void saveProducts(nextProducts);
  };

  const getProductSelectionKey = (product: Product, variant?: ProductVariant) =>
    variant ? `${product.id}:${variant.id}` : product.id;

  const getSelectedProductEntries = (selectionKeys: string[]) =>
    Array.from(new Set(selectionKeys)).map((selectionKey) => {
      const [productId, ...variantParts] = selectionKey.split(":");
      const variantId = variantParts.length > 0 ? variantParts.join(":") : undefined;
      return { productId: productId ?? selectionKey, variantId };
    });

  const getProductIdFromSelectionKey = (selectionKey: string) =>
    selectionKey.split(":")[0] ?? selectionKey;

  const normalizeProductSelection = (selectionKeys: string[]) =>
    Array.from(
      new Set(
        selectionKeys
          .map((selectionKey) => getProductIdFromSelectionKey(selectionKey))
          .filter((productId): productId is string => Boolean(productId)),
      ),
    );

  const getSelectedProductIdsFromKeys = (selectionKeys: string[]) =>
    normalizeProductSelection(selectionKeys);

  const getSelectionKeyVariantId = (selectionKey: string) => {
    const [, variantId] = selectionKey.split(":");
    return variantId ?? "base";
  };

  const clearBulkProductSelection = () => {
    setSelectionMode(false);
    setSelectedProductIds([]);
    setBulkEditQueue([]);
    setBulkQuickEditQueue([]);
    setBulkEditPosition(0);
    bulkEditQueueRef.current = [];
    bulkEditPositionRef.current = 0;
  };

  const getBulkProductQueue = () => normalizeProductSelection(selectedProductIds);

  const resolveQuickEditSelection = (selectionKey: string) => {
    const [productId, ...variantParts] = selectionKey.split(":");
    const variantId = variantParts.length > 0 ? variantParts.join(":") : undefined;
    const product =
      editableProducts.find((item) => item.id === productId) ??
      (productsData as Product[]).find((item) => item.id === productId);
    if (!product) return null;
    const variant = variantId ? product.variants?.find((item) => item.id === variantId) : undefined;
    return { product, variant };
  };

  const toggleProductSelection = (selectionKey: string, checked: boolean) => {
    setSelectedProductIds((current) => {
      const next = checked
        ? current.includes(selectionKey)
          ? current
          : [...current, selectionKey]
        : current.filter((key) => key !== selectionKey);

      setSelectionMode(next.length > 0);
      return next;
    });
  };

  const handleBulkDeleteProducts = async () => {
    const selectedEntries = getSelectedProductEntries(selectedProductIds);
    const selectedProductIdsSet = new Set(
      selectedEntries.filter((entry) => !entry.variantId).map((entry) => entry.productId),
    );
    const selectedVariantIdsByProduct = new Map<string, string[]>();
    for (const entry of selectedEntries) {
      if (!entry.variantId) continue;
      const current = selectedVariantIdsByProduct.get(entry.productId) ?? [];
      current.push(entry.variantId);
      selectedVariantIdsByProduct.set(entry.productId, current);
    }

    const nextProducts = (productsData as Product[])
      .map((product) => {
        const selectedVariantIds = selectedVariantIdsByProduct.get(product.id) ?? [];
        const hasWholeProductSelection = selectedProductIdsSet.has(product.id);

        if (hasWholeProductSelection && !selectedVariantIds.length) {
          moveToTrash({ type: "producto", id: product.id, item: product });
          return null;
        }

        if (selectedVariantIds.length > 0) {
          const remainingVariants = (product.variants ?? []).filter(
            (variant) => !selectedVariantIds.includes(variant.id),
          );

          if (remainingVariants.length === 0 && !hasWholeProductSelection) {
            moveToTrash({ type: "producto", id: product.id, item: product });
            return null;
          }

          return {
            ...product,
            variants: remainingVariants,
          };
        }

        return product;
      })
      .filter((product): product is Product => Boolean(product));

    if (!nextProducts.length && !selectedProductIdsSet.size && !selectedVariantIdsByProduct.size) {
      return;
    }

    productsData.splice(0, productsData.length, ...nextProducts);
    setEditableProducts(nextProducts);
    await saveProducts(nextProducts);
    toast.success(
      `${selectedEntries.length} elemento${selectedEntries.length === 1 ? "" : "s"} eliminado${selectedEntries.length === 1 ? "" : "s"}`,
    );
    clearBulkProductSelection();
  };

  const handleBulkToggleProducts = async (hidden: boolean) => {
    const selectedEntries = getSelectedProductEntries(selectedProductIds);
    if (!selectedEntries.length) return;

    const nextProducts = (productsData as Product[]).map((product) => {
      const productSelectedEntries = selectedEntries.filter(
        (entry) => entry.productId === product.id,
      );
      if (!productSelectedEntries.length) return product;

      const selectedVariantIds = productSelectedEntries
        .filter((entry) => entry.variantId)
        .map((entry) => entry.variantId)
        .filter((variantId): variantId is string => Boolean(variantId));

      const hasWholeProductSelection = productSelectedEntries.some((entry) => !entry.variantId);

      if (selectedVariantIds.length > 0) {
        return {
          ...product,
          variants: (product.variants ?? []).map((variant) =>
            selectedVariantIds.includes(variant.id) ? { ...variant, hidden } : variant,
          ),
        };
      }

      if (hasWholeProductSelection) {
        return { ...product, hidden };
      }

      return product;
    });

    productsData.splice(0, productsData.length, ...nextProducts);
    setEditableProducts(nextProducts);
    await saveProducts(nextProducts);

    const hiddenProductsCount = selectedEntries.reduce((count, entry) => {
      const product = nextProducts.find((item) => item.id === entry.productId);
      if (!product) return count;

      const isHidden = entry.variantId
        ? Boolean(
            (product.variants ?? []).find((variant) => variant.id === entry.variantId)?.hidden,
          )
        : Boolean(product.hidden);

      return isHidden ? count + 1 : count;
    }, 0);
    const availableProductsCount = selectedEntries.length - hiddenProductsCount;

    toast.success(hidden ? "Productos ocultados" : "Productos disponibles", {
      description: `${hiddenProductsCount} ocultos · ${availableProductsCount} disponibles`,
    });
    clearBulkProductSelection();
  };

  const handleBulkDuplicateProducts = async () => {
    const selectedEntries = getSelectedProductEntries(selectedProductIds);
    if (!selectedEntries.length) return;

    const duplicates: Product[] = [];
    for (const entry of selectedEntries) {
      const product = (productsData as Product[]).find((item) => item.id === entry.productId);
      if (!product) continue;

      if (!entry.variantId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 7);
        const newId = `${product.id}-copy-${timestamp}-${random}`;
        const newSlug = `${product.slug}-copy-${timestamp}`
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/--+/g, "-");

        duplicates.push({
          ...product,
          id: newId,
          slug: newSlug,
          name: `${product.name} (Copia)`,
          createdAt: new Date().toISOString().slice(0, 10),
          hidden: Boolean(product.hidden),
        });
        continue;
      }

      const selectedVariant = product.variants?.find((variant) => variant.id === entry.variantId);
      if (!selectedVariant) continue;

      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 7);
      const newId = `${product.id}-copy-${timestamp}-${random}`;
      const newSlug = `${product.slug}-copy-${timestamp}`
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-");
      const duplicatedVariant = {
        ...selectedVariant,
        id: `${selectedVariant.id}-copy-${timestamp}-${random}`,
        hidden: Boolean(selectedVariant.hidden),
      };

      duplicates.push({
        ...product,
        id: newId,
        slug: newSlug,
        name: `${product.name} (Copia)`,
        variantName: selectedVariant.name,
        variants: [duplicatedVariant],
        hidden: Boolean(product.hidden),
        createdAt: new Date().toISOString().slice(0, 10),
      });
    }

    if (!duplicates.length) return;

    const nextProducts = [...(productsData as Product[]), ...duplicates];
    productsData.splice(0, productsData.length, ...nextProducts);
    setEditableProducts(nextProducts);
    await saveProducts(nextProducts);
    toast.success(
      `${duplicates.length} elemento${duplicates.length === 1 ? "" : "s"} duplicado${duplicates.length === 1 ? "" : "s"}`,
    );
    clearBulkProductSelection();
  };

  const clearBulkSelection = () => {
    setSelectionMode(false);
    setSelectedProductIds([]);
    setBulkEditQueue([]);
    setBulkEditPosition(0);
    bulkEditQueueRef.current = [];
    bulkEditPositionRef.current = 0;
  };

  const closeProductEditor = () => {
    setProductForm(null);
    setEditingProduct(null);
    setInitialVariantId(null);
    clearBulkProductSelection();
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
  };

  const handleBulkEditProducts = () => {
    const selectedProductIdsForBulk = getBulkProductQueue();
    if (!selectedProductIdsForBulk.length) return;

    const firstProductId = selectedProductIdsForBulk[0];
    const product =
      editableProducts.find((item) => item.id === firstProductId) ??
      (productsData as Product[]).find((item) => item.id === firstProductId);

    if (!product) return;

    bulkEditQueueRef.current = selectedProductIdsForBulk;
    bulkEditPositionRef.current = 0;
    setBulkEditQueue(selectedProductIdsForBulk);
    setBulkEditPosition(0);

    const firstVariant = product.variants?.[0];
    openEditProductDialog(product, firstVariant);
  };

  const handleBulkQuickEditProducts = () => {
    const queue = [...selectedProductIds];
    if (!queue.length) return;

    const firstSelection = queue[0];
    if (!firstSelection) return;

    const firstEntry = resolveQuickEditSelection(firstSelection);
    if (!firstEntry) return;

    setBulkQuickEditQueue(queue.slice(1));
    startQuickEdit(firstEntry.product, firstEntry.variant);
  };

  const navigateBulkEditProduct = (direction: -1 | 1) => {
    const queue =
      bulkEditQueueRef.current.length > 0 ? bulkEditQueueRef.current : getBulkProductQueue();
    const nextPosition = bulkEditPositionRef.current + direction;
    if (nextPosition < 0 || nextPosition >= queue.length) return;

    const nextProductId = queue[nextPosition];
    if (!nextProductId) return;

    const nextProduct =
      editableProducts.find((product) => product.id === nextProductId) ??
      (productsData as Product[]).find((product) => product.id === nextProductId);
    if (!nextProduct) return;

    bulkEditQueueRef.current = queue;
    bulkEditPositionRef.current = nextPosition;
    setBulkEditQueue(queue);
    setBulkEditPosition(nextPosition);

    const nextVariant = nextProduct.variants?.[0];
    openEditProductDialog(nextProduct, nextVariant);
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
        name: product.name,
        variantName: variant?.name ?? "",
        category: product.category,
        price: source.price,
        comision: source.comision ?? 0,
        comisionCurrency: source.comisionCurrency ?? product.comisionCurrency ?? "ARS",
        gastos: source.gastos ?? 0,
        gastosCurrency: source.gastosCurrency ?? product.gastosCurrency ?? "ARS",
        stock: source.stock,
        discount: variant?.discount ?? discounts[product.id] ?? 0,
      },
    }));
  };

  const cancelQuickEdit = () => {
    const currentSelectionKey = quickEditProductId
      ? `${quickEditProductId}:${quickEditVariantId ?? "base"}`
      : null;
    const remainingQueue = bulkQuickEditQueue.filter(
      (selectionKey) => selectionKey !== currentSelectionKey,
    );
    const nextQueuedSelectionKey = remainingQueue[0];
    const nextQuickEditEntry = nextQueuedSelectionKey
      ? resolveQuickEditSelection(nextQueuedSelectionKey)
      : null;

    setBulkQuickEditQueue(remainingQueue);
    setQuickEditProductId(null);
    setQuickEditVariantId(null);
    setQuickEditForm((current) => {
      const next = { ...current };
      if (currentSelectionKey) {
        delete next[currentSelectionKey];
      }
      return next;
    });

    if (nextQuickEditEntry) {
      startQuickEdit(nextQuickEditEntry.product, nextQuickEditEntry.variant);
    }
  };

  const cancelQuickEditSession = () => {
    const currentSelectionKey = quickEditProductId
      ? `${quickEditProductId}:${quickEditVariantId ?? "base"}`
      : null;
    setQuickEditProductId(null);
    setQuickEditVariantId(null);
    setBulkQuickEditQueue([]);
    setQuickEditForm((current) => {
      const next = { ...current };
      if (currentSelectionKey) delete next[currentSelectionKey];
      return next;
    });
    clearBulkProductSelection();
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
    const nextVariantName = draft.variantName.trim() || variant?.name || "";
    const nextCategory = draft.category.trim() || product.category;
    const nextPrice = Number(draft.price) || product.price;
    const nextComision = Math.max(0, Number(draft.comision) || 0);
    const nextComisionCurrency = draft.comisionCurrency;
    const nextGastos = Math.max(0, Number(draft.gastos) || 0);
    const nextGastosCurrency = draft.gastosCurrency;
    const nextStock = Number(draft.stock) || product.stock;
    const nextDiscount = Math.max(0, Math.min(100, Number(draft.discount) || 0));

    setEditableProducts((current) =>
      current.map((item) => {
        if (item.id !== product.id) return item;
        if (variant) {
          return {
            ...item,
            name: nextName,
            variants: item.variants?.map((itemVariant) =>
              itemVariant.id === variant.id
                ? {
                    ...itemVariant,
                    name: nextVariantName,
                    price: nextPrice,
                    comision: nextComision,
                    comisionCurrency: nextComisionCurrency,
                    gastos: nextGastos,
                    gastosCurrency: nextGastosCurrency,
                    stock: nextStock,
                    discount: nextDiscount,
                  }
                : itemVariant,
            ),
          };
        }
        return {
          ...item,
          brand: nextBrand,
          name: nextName,
          category: nextCategory,
          price: nextPrice,
          comision: nextComision,
          comisionCurrency: nextComisionCurrency,
          gastos: nextGastos,
          gastosCurrency: nextGastosCurrency,
          stock: nextStock,
        };
      }),
    );

    const productIndex = (productsData as Product[]).findIndex((item) => item.id === product.id);
    if (productIndex !== -1) {
      const existing = (productsData as Product[])[productIndex] as Product;
      if (variant) {
        existing.name = nextName;
        existing.variants = existing.variants?.map((itemVariant) =>
          itemVariant.id === variant.id
            ? {
                ...itemVariant,
                name: nextVariantName,
                price: nextPrice,
                comision: nextComision,
                comisionCurrency: nextComisionCurrency,
                gastos: nextGastos,
                gastosCurrency: nextGastosCurrency,
                stock: nextStock,
                discount: nextDiscount,
              }
            : itemVariant,
        );
      } else {
        existing.brand = nextBrand;
        existing.name = nextName;
        existing.category = nextCategory;
        existing.price = nextPrice;
        existing.comision = nextComision;
        existing.comisionCurrency = nextComisionCurrency;
        existing.gastos = nextGastos;
        existing.gastosCurrency = nextGastosCurrency;
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

    const currentSelectionKey = key;
    const remainingQueue = bulkQuickEditQueue.filter(
      (selectionKey) => selectionKey !== currentSelectionKey,
    );
    const nextQueuedSelectionKey = remainingQueue[0];
    const nextQuickEditEntry = nextQueuedSelectionKey
      ? resolveQuickEditSelection(nextQueuedSelectionKey)
      : null;

    setQuickEditProductId(null);
    setQuickEditVariantId(null);
    setQuickEditForm((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setBulkQuickEditQueue(remainingQueue);

    if (nextQuickEditEntry) {
      startQuickEdit(nextQuickEditEntry.product, nextQuickEditEntry.variant);
    }
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

  const persistProduct = async () => {
    if (!productForm) return;

    const processedImages = await Promise.all(productForm.images.map(cropImageDataUrl));

    let savedProductId = productForm.id;

    const normalizedBrand: BrandSlug = productForm.brand || "arcade";
    const normalizedDeliveryUnit: DeliveryUnit = productForm.deliveryUnit || "inmediata";

    setEditableProducts((current) => {
      const updated = current.map((item) =>
        item.id === productForm.id
          ? {
              ...item,
              name: productForm.name,
              brand: normalizedBrand,
              category: productForm.category,
              subcategory: productForm.subcategory || undefined,
              price: productForm.price,
              priceCurrency: productForm.priceCurrency,
              comision: productForm.comision,
              comisionCurrency: productForm.comisionCurrency,
              gastos: productForm.gastos,
              gastosCurrency: productForm.gastosCurrency,
              stock: productForm.stock,
              stockUnlimited: productForm.stockUnlimited,
              description: productForm.description,
              features: productForm.features,
              includes: productForm.includes,
              images: processedImages,
              variants: productForm.variants,
              supplier: productForm.supplier,
              deliveryUnit: normalizedDeliveryUnit,
              deliveryAmount: productForm.deliveryAmount,
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
          brand: normalizedBrand,
          name: productForm.name,
          category: productForm.category,
          subcategory: productForm.subcategory || undefined,
          price: productForm.price,
          priceCurrency: productForm.priceCurrency,
          comision: productForm.comision,
          comisionCurrency: productForm.comisionCurrency,
          gastos: productForm.gastos,
          gastosCurrency: productForm.gastosCurrency,
          usdRate: productForm.usdRate,
          stock: productForm.stock,
          stockUnlimited: productForm.stockUnlimited,
          rating: 0,
          reviews: 0,
          short: productForm.description,
          description: productForm.description,
          features: productForm.features,
          includes: productForm.includes,
          images: processedImages,
          variants: productForm.variants,
          supplier: productForm.supplier,
          deliveryUnit: normalizedDeliveryUnit,
          deliveryAmount: productForm.deliveryAmount,
          createdAt: new Date().toISOString().slice(0, 10),
        } as Product;

        (productsData as Product[]).push(newProduct);
        return [...current, newProduct];
      }

      const existingIndex = (productsData as Product[]).findIndex(
        (item) => item.id === productForm.id,
      );
      if (existingIndex !== -1) {
        const existing = (productsData as Product[])[existingIndex] as Product;
        existing.name = productForm.name;
        existing.brand = normalizedBrand;
        existing.category = productForm.category;
        existing.subcategory = productForm.subcategory || undefined;
        existing.price = productForm.price;
        existing.priceCurrency = productForm.priceCurrency;
        existing.comision = productForm.comision;
        existing.comisionCurrency = productForm.comisionCurrency;
        existing.gastos = productForm.gastos;
        existing.gastosCurrency = productForm.gastosCurrency;
        existing.usdRate = productForm.usdRate;
        existing.stock = productForm.stock;
        existing.stockUnlimited = productForm.stockUnlimited;
        existing.description = productForm.description;
        existing.features = productForm.features;
        existing.includes = productForm.includes;
        existing.images = processedImages;
        existing.variants = productForm.variants;
        existing.supplier = productForm.supplier;
        existing.deliveryUnit = normalizedDeliveryUnit;
        existing.deliveryAmount = productForm.deliveryAmount;
      }

      return updated;
    });

    if (savedProductId) {
      setDiscounts((current) => ({
        ...current,
        [savedProductId]: productForm.discount,
      }));
    }

    await saveProducts(productsData as Product[]);
    queryClient.setQueryData(catalogQueries.allAdmin().queryKey, [...productsData]);
    void queryClient.invalidateQueries({
      queryKey: ["products"],
      refetchType: "active",
    });
    toast.success("Producto guardado");
    const nextBulkPosition = bulkEditPositionRef.current + 1;
    const queue = bulkEditQueueRef.current;
    const nextBulkSelectionKey = queue[nextBulkPosition];
    if (nextBulkSelectionKey) {
      const nextProduct =
        (productsData as Product[]).find(
          (product) => product.id === getProductIdFromSelectionKey(nextBulkSelectionKey),
        ) ??
        editableProducts.find(
          (product) => product.id === getProductIdFromSelectionKey(nextBulkSelectionKey),
        );
      if (nextProduct) {
        bulkEditPositionRef.current = nextBulkPosition;
        setBulkEditPosition(nextBulkPosition);
        const variantId = nextBulkSelectionKey.split(":")[1];
        openEditProductDialog(
          nextProduct,
          variantId && variantId !== "base"
            ? nextProduct.variants?.find((variant) => variant.id === variantId)
            : undefined,
        );
        return;
      }
    }
    closeProductEditor();
  };

  const handleSaveProduct = async () => {
    if (isSavingProduct) return;
    setIsSavingProduct(true);
    try {
      await persistProduct();
    } finally {
      setIsSavingProduct(false);
    }
  };

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
  const categoryLabels = useMemo(() => {
    const labels = new Map<string, string>();
    const collect = (items: CategoryLabelNode[]) => {
      items.forEach((item) => {
        labels.set(item.slug, item.name);
        if (item.children) collect(item.children);
      });
    };
    brandList.forEach((brand) => {
      brand.categories.forEach((category) => {
        labels.set(category.slug, category.name);
        collect(category.subcategories ?? []);
      });
    });
    return labels;
  }, []);
  const formatCategoryLabel = (slug: string) => {
    const configuredLabel =
      categoryLabels.get(slug) ?? categoryLabels.get(slug.replace(/^root-/, ""));
    if (configuredLabel) return configuredLabel;
    return slug
      .replace(/^\d+-/, "")
      .replace(/^root-/, "")
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const results = useMemo(() => {
    const filtered = editableProducts.filter((product) => {
      if (brandFilter.length && !brandFilter.includes(product.brand)) return false;
      if (categoryFilter.length && !categoryFilter.includes(product.category)) return false;
      if (currencyFilter.length && !currencyFilter.includes(product.priceCurrency ?? "ARS"))
        return false;
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
  }, [
    editableProducts,
    query,
    brandFilter,
    categoryFilter,
    currencyFilter,
    priceMode,
    priceMin,
    priceMax,
    discountOnly,
    stockOnly,
    availableOnly,
    sortOrder,
    discounts,
  ]);

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
  type DisplayRow = { product: Product; variant: ProductVariant | undefined };

  const displayRows = useMemo<DisplayRow[]>(() => {
    return visibleResults.flatMap((product): DisplayRow[] => {
      if (product.variants && product.variants.length > 0) {
        return product.variants.map((variant) => ({ product, variant }));
      }
      return [{ product, variant: undefined }];
    });
  }, [visibleResults]);
  const visibleProductSelectionKeys = Array.from(
    new Set(displayRows.map(({ product, variant }) => getProductSelectionKey(product, variant))),
  );
  const selectedVisibleProductKeys = visibleProductSelectionKeys.filter((key) =>
    selectedProductIds.includes(key),
  );
  const allVisibleProductsSelected =
    visibleProductSelectionKeys.length > 0 &&
    selectedVisibleProductKeys.length === visibleProductSelectionKeys.length;
  const someVisibleProductsSelected =
    selectedVisibleProductKeys.length > 0 && !allVisibleProductsSelected;
  const totalPages =
    pageSize && pageSize > 0 ? Math.max(1, Math.ceil(results.length / pageSize)) : 1;
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
  const priceFilterCount =
    (currencyFilter.length === 1 ? 1 : 0) +
    (priceMode !== "storePrice" ? 1 : 0) +
    (priceMin > 0 ? 1 : 0) +
    (priceMax < priceLimit ? 1 : 0);
  const adminFilterChips: FilterChipItem[] = [
    ...(query ? [{ key: "query", label: `Buscar: ${query}`, onRemove: () => setQuery("") }] : []),
    ...categoryFilter.map((value) => ({
      key: `category-${value}`,
      label: value,
      onRemove: () => setCategoryFilter((current) => current.filter((item) => item !== value)),
    })),
    ...brandFilter.map((value) => ({
      key: `brand-${value}`,
      label: brandList.find((brand) => brand.slug === value)?.name ?? value,
      onRemove: () => setBrandFilter((current) => current.filter((item) => item !== value)),
    })),
    ...(currencyFilter.length === 1
      ? [
          {
            key: `currency-${currencyFilter[0]}`,
            label: currencyFilter[0] === "ARS" ? "$ (ARS)" : "USD (Dólar)",
            onRemove: () => setCurrencyFilter(["ARS", "USD"]),
          },
        ]
      : []),
    ...(priceMode !== "storePrice"
      ? [{ key: "price-mode", label: "Precio", onRemove: () => setPriceMode("storePrice") }]
      : []),
    ...(priceMin > 0
      ? [{ key: "price-min", label: `Desde ${priceMin}`, onRemove: () => setPriceMin(0) }]
      : []),
    ...(priceMax < priceLimit
      ? [{ key: "price-max", label: `Hasta ${priceMax}`, onRemove: () => setPriceMax(priceLimit) }]
      : []),
    ...(discountOnly
      ? [{ key: "discount", label: "Sólo con descuento", onRemove: () => setDiscountOnly(false) }]
      : []),
    ...(stockOnly
      ? [{ key: "stock", label: "Sólo con stock", onRemove: () => setStockOnly(false) }]
      : []),
    ...(availableOnly
      ? [{ key: "available", label: "Sólo disponible", onRemove: () => setAvailableOnly(false) }]
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="order-1 basis-full shrink-0">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
          <h1 className="mt-2 text-3xl font-semibold">Productos</h1>
        </div>

        <div className="order-2 relative min-w-0 basis-full flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto"
            className="h-9 pl-9"
          />
        </div>

        <div className="order-3 flex basis-full flex-col gap-2 sm:basis-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 sm:shrink-0">
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:contents">
            <Button className="h-9 w-full gap-2 sm:w-auto" onClick={openNewProductDialog}>
              <Plus className="size-4" /> Nuevo producto
            </Button>
          </div>

          <div className="flex w-full flex-nowrap items-center justify-start gap-1 sm:contents sm:gap-2">
            <Dialog open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  ref={sortButtonRef}
                  variant={sortMenuOpen ? "secondary" : "outline"}
                  size="sm"
                  className="h-9 shrink-0 gap-1.5 px-2.5"
                  aria-expanded={sortMenuOpen}
                >
                  <ArrowUpDown className="size-4 text-white" />
                  Ordenar por
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                <DialogHeader className="space-y-2">
                  <DialogTitle>Ordenar por</DialogTitle>
                </DialogHeader>
                <div className="space-y-1 pt-2">
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
                        sortOrder === value
                          ? "bg-surface-2 text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span>{label}</span>
                      {sortOrder === value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
              <DialogTrigger asChild>
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
              </DialogTrigger>

              <DialogContent className="max-w-3xl rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                <DialogHeader className="space-y-2">
                  <DialogTitle>Filtros</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setCategoriesOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={categoriesOpen}
                    >
                      <span>Categorías</span>
                      {categoryFilter.length > 0 && (
                        <Badge variant="secondary">{categoryFilter.length}</Badge>
                      )}
                      {categoriesOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {categoriesOpen && (
                      <div className="space-y-2.5">
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={categoryFilter.length === 0}
                            onCheckedChange={() => setCategoryFilter([])}
                          />
                          <span className="font-medium">Todos</span>
                        </label>
                        {availableCategories.map((category) => (
                          <label
                            key={category}
                            className="flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <Checkbox
                              checked={categoryFilter.includes(category)}
                              onCheckedChange={(checked) =>
                                setCategoryFilter((current) => {
                                  const next = checked
                                    ? [...current, category]
                                    : current.filter((value) => value !== category);
                                  return availableCategories.every((value) => next.includes(value))
                                    ? []
                                    : Array.from(new Set(next));
                                })
                              }
                            />
                            <span className="font-medium">{formatCategoryLabel(category)}</span>
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
                      {brandFilter.length > 0 && (
                        <Badge variant="secondary">{brandFilter.length}</Badge>
                      )}
                      {brandsOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {brandsOpen && (
                      <div className="space-y-2.5">
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={brandFilter.length === 0}
                            onCheckedChange={() => setBrandFilter([])}
                          />
                          <span className="font-medium">Todos</span>
                        </label>
                        {brandList.map((brand) => (
                          <label
                            key={brand.slug}
                            className="flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <Checkbox
                              checked={brandFilter.includes(brand.slug)}
                              onCheckedChange={(checked) =>
                                setBrandFilter((current) => {
                                  const next = checked
                                    ? [...current, brand.slug]
                                    : current.filter((value) => value !== brand.slug);
                                  return brandList.every((availableBrand) =>
                                    next.includes(availableBrand.slug),
                                  )
                                    ? []
                                    : Array.from(new Set(next));
                                })
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
                      {priceFilterCount > 0 && (
                        <Badge variant="secondary">{priceFilterCount}</Badge>
                      )}
                      {priceFilterOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {priceFilterOpen && (
                      <div className="space-y-2.5">
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={currencyFilter.includes("ARS")}
                            onCheckedChange={(checked) =>
                              setCurrencyFilter((current) =>
                                checked
                                  ? Array.from(new Set([...current, "ARS"]))
                                  : current.length === 1
                                    ? current
                                    : current.filter((value) => value !== "ARS"),
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
                                checked
                                  ? Array.from(new Set([...current, "USD"]))
                                  : current.length === 1
                                    ? current
                                    : current.filter((value) => value !== "USD"),
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

                  <div className="mx-1 flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
                    <Label htmlFor="admin-filter-discount" className="cursor-pointer text-sm">
                      Sólo con descuento
                    </Label>
                    <Switch
                      id="admin-filter-discount"
                      checked={discountOnly}
                      onCheckedChange={setDiscountOnly}
                    />
                  </div>

                  <div className="mx-1 flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
                    <Label htmlFor="admin-filter-stock" className="cursor-pointer text-sm">
                      Sólo con stock
                    </Label>
                    <Switch
                      id="admin-filter-stock"
                      checked={stockOnly}
                      onCheckedChange={setStockOnly}
                    />
                  </div>

                  <div className="mx-1 flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2.5">
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
                    <p className="text-xs text-muted-foreground">
                      {results.length} productos encontrados
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      disabled={activeFilterCount === 0}
                      className="ml-auto flex h-8 px-2 text-xs"
                    >
                      <X className="mr-1 size-3.5" /> Limpiar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-0 shrink gap-1 border-amber-500/50 bg-amber-500/10 px-2 text-xs text-amber-600 hover:bg-amber-500/20 hover:text-amber-700 sm:gap-2 sm:px-3 sm:text-sm"
              onClick={() => {
                setUsdRatePromptValue(usdRate > 0 ? String(usdRate) : "");
                setUsdRatePromptOpen(true);
              }}
            >
              Seleccionar USD
            </Button>
          </div>

          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:contents">
            <Button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700"
              onClick={() => {
                const rows: (string | number)[][] = [
                  ["ID", "Nombre", "Marca", "Categoria", "Precio", "Stock", "Descuento"],
                ];

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
                  return [
                    p.id,
                    p.name,
                    p.brand,
                    p.category ?? "",
                    p.price ?? 0,
                    p.stock ?? 0,
                    `${discounted}%`,
                  ];
                });

                const tableHtml = `
                <!DOCTYPE html>
                <html lang="es">
                  <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
                                .map(
                                  (cell) =>
                                    `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`,
                                )
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
          </div>
        </div>
      </div>

      <div className="mt-2 flex min-h-9 basis-full flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 leading-none">
          <button
            type="button"
            className="text-sm font-medium text-foreground leading-none"
            onClick={() => {
              setSelectionMode((current) => {
                if (current) {
                  clearBulkProductSelection();
                  return false;
                }
                return true;
              });
            }}
          >
            Seleccionar
          </button>
          <Checkbox
            className="h-4 w-4 rounded-full border-2 border-primary bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            checked={
              allVisibleProductsSelected
                ? true
                : someVisibleProductsSelected
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) => {
              if (checked === false) {
                clearBulkProductSelection();
                return;
              }
              const shouldSelect = checked === true || checked === "indeterminate";
              setSelectedProductIds((current) => {
                const next = shouldSelect
                  ? Array.from(new Set([...current, ...visibleProductSelectionKeys]))
                  : current.filter((key) => !visibleProductSelectionKeys.includes(key));

                setSelectionMode(next.length > 0);
                return next;
              });
            }}
            aria-label="Seleccionar productos visibles"
          />
          {selectedProductIds.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {selectedProductIds.length} seleccionados
            </span>
          ) : null}
        </div>
        {selectedProductIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {quickEditProductId !== null ? (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    const currentProduct = editableProducts.find(
                      (product) => product.id === quickEditProductId,
                    );
                    const currentVariant = quickEditVariantId
                      ? currentProduct?.variants?.find(
                          (variant) => variant.id === quickEditVariantId,
                        )
                      : undefined;
                    if (currentProduct) {
                      saveQuickEdit(currentProduct, currentVariant);
                    }
                  }}
                >
                  <Check className="size-4" /> Guardar
                </Button>
                <Button size="sm" variant="destructive" onClick={cancelQuickEdit}>
                  <X className="size-4" /> Saltar
                </Button>
                <Button size="sm" variant="outline" onClick={cancelQuickEditSession}>
                  <X className="size-4" /> Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={handleBulkQuickEditProducts}>
                  <Edit3 className="size-4" /> Editar rápido
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkEditProducts}>
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkToggleProducts(false)}>
                  <Eye className="size-4" /> Disponible
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkToggleProducts(true)}>
                  <EyeOff className="size-4" /> No disponible
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkDuplicateProducts}>
                  <Copy className="size-4" /> Duplicar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setConfirmState({
                      open: true,
                      title: "Eliminar productos seleccionados?",
                      description: "Esta acción no se puede deshacer.",
                      onConfirm: handleBulkDeleteProducts,
                    })
                  }
                >
                  <Trash2 className="size-4" /> Eliminar
                </Button>
                <Button size="sm" variant="outline" onClick={clearBulkSelection}>
                  <X className="size-4" /> Cancelar
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <FilterChipList chips={adminFilterChips} />
      <div className="mt-4 rounded-2xl">
        <div className="glass-panel min-w-0 flex-1 overflow-visible rounded-2xl">
          <Table
            hideScrollbarOnMobile
            alwaysShowScrollbarOnDesktop
            stickyHeader
            stickyScrollbar
            containerClassName="overflow-x-auto overflow-y-visible"
            className={cn(
              "w-full text-center text-sm [&_td]:align-middle [&_th]:align-middle [&_td]:py-2 [&_th]:py-2",
              selectionMode ? "min-w-208" : "min-w-max",
            )}
          >
            <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-center [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
              <TableRow>
                <TableHead className="w-12 min-w-12 max-w-12 px-2"> </TableHead>
                <TableHead className="w-40 text-center">Producto</TableHead>
                <TableHead className="w-20 text-center">Tienda</TableHead>
                <TableHead className="w-16 text-center">Stock</TableHead>
                <TableHead className="w-24 text-center">Mi comisión</TableHead>
                <TableHead className="w-20 text-center">Gastos</TableHead>
                <TableHead className="w-20 text-center">Precio</TableHead>
                <TableHead className="w-20 text-center">Descuento</TableHead>
                <TableHead className="w-24 text-center">Precio tienda</TableHead>
                <TableHead className="w-24 text-center">Ganancias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map(({ product, variant }) => {
                const discount = variant?.discount ?? discounts[product.id] ?? 0;
                const displayPrice = variant?.price ?? product.price;
                const isUnlimitedStock = variant?.stockUnlimited ?? product.stockUnlimited ?? false;
                const displayStock = isUnlimitedStock ? "∞" : (variant?.stock ?? product.stock);
                const displayComision = variant?.comision ?? product.comision ?? 0;
                const displayGastos = variant?.gastos ?? product.gastos ?? 0;
                const displayPriceCurrency =
                  variant?.priceCurrency ?? product.priceCurrency ?? "ARS";
                const displayComisionCurrency =
                  variant?.comisionCurrency ?? product.comisionCurrency ?? "ARS";
                const displayGastosCurrency =
                  variant?.gastosCurrency ?? product.gastosCurrency ?? "ARS";
                const displayUsdRate = product.usdRate ?? 0;
                const discountedPrice = displayPrice * (1 - discount / 100);
                const discountedPriceInArs =
                  displayPriceCurrency === "USD"
                    ? discountedPrice * displayUsdRate
                    : discountedPrice;
                const gastosInArs =
                  displayGastosCurrency === "USD" ? displayGastos * displayUsdRate : displayGastos;
                const displayProfit =
                  displayPriceCurrency === displayGastosCurrency
                    ? discountedPrice - displayGastos
                    : discountedPriceInArs - gastosInArs;
                const displayProfitCurrency =
                  displayPriceCurrency === displayGastosCurrency ? displayPriceCurrency : "ARS";
                const quickEditKey = getQuickEditKey(product, variant);
                const isQuickEditing =
                  quickEditProductId === product.id && quickEditVariantId === (variant?.id ?? null);
                const quickDraft = quickEditForm[quickEditKey] ?? {
                  brand: product.brand,
                  name: product.name,
                  category: product.category,
                  price: product.price,
                  comision: product.comision ?? 0,
                  comisionCurrency: product.comisionCurrency ?? "ARS",
                  gastos: product.gastos ?? 0,
                  gastosCurrency: product.gastosCurrency ?? "ARS",
                  stock: product.stock,
                  discount,
                  variantName: variant?.name ?? "",
                };
                const activeQuickBrand = quickDraft.brand ?? product.brand;

                return (
                  <TableRow
                    key={`${product.id}-${variant?.id ?? "base"}`}
                    onClick={(event) => {
                      if (
                        selectionMode ||
                        isQuickEditing ||
                        (event.target as HTMLElement).closest(
                          "button, input, [role=checkbox], [role=combobox], a",
                        )
                      )
                        return;
                      openEditProductDialog(product, variant);
                    }}
                    className={cn(
                      !selectionMode && !isQuickEditing && "cursor-pointer hover:bg-transparent",
                    )}
                  >
                    <TableCell className="w-12 min-w-12 max-w-12 px-2">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          className="h-4 w-4 rounded-full border-2 border-primary bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          checked={selectedProductIds.includes(
                            getProductSelectionKey(product, variant),
                          )}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            const selectionKey = getProductSelectionKey(product, variant);
                            setSelectedProductIds((current) => {
                              const next = isChecked
                                ? [...new Set([...current, selectionKey])]
                                : current.filter((key) => key !== selectionKey);
                              setSelectionMode(next.length > 0);
                              return next;
                            });
                          }}
                          aria-label={`Seleccionar ${product.name}${variant ? ` ${variant.name}` : ""}`}
                        />
                      </div>
                    </TableCell>

                    {isQuickEditing ? (
                      <>
                        <TableCell className="min-w-64 align-middle text-center">
                          <div className="flex min-w-60 flex-col gap-2 text-left">
                            <div className="flex items-center gap-2">
                              <Input
                                value={quickDraft.name}
                                onChange={(event) =>
                                  setQuickEditForm((current) => ({
                                    ...current,
                                    [quickEditKey]: { ...quickDraft, name: event.target.value },
                                  }))
                                }
                                className="w-full min-w-52 text-center"
                              />
                            </div>
                            {variant ? (
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                                  Variante
                                </span>
                                <Input
                                  value={quickDraft.variantName}
                                  onChange={(event) =>
                                    setQuickEditForm((current) => ({
                                      ...current,
                                      [quickEditKey]: {
                                        ...quickDraft,
                                        variantName: event.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full min-w-44 text-center"
                                />
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-48 align-middle">
                          <Select
                            value={activeQuickBrand}
                            onValueChange={(value) => {
                              const nextBrand = value as BrandSlug;
                              const nextCategory =
                                brands[nextBrand].categories[0]?.slug ?? quickDraft.category;
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
                            <SelectTrigger className="w-full min-w-44">
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
                        <TableCell className="min-w-32 align-middle">
                          <Input
                            type="number"
                            min={0}
                            value={quickDraft.stock}
                            onChange={(event) =>
                              setQuickEditForm((current) => ({
                                ...current,
                                [quickEditKey]: {
                                  ...quickDraft,
                                  stock: Number(event.target.value),
                                },
                              }))
                            }
                            className="w-full min-w-28 text-center"
                          />
                        </TableCell>
                        <TableCell className="min-w-36 align-middle">
                          <div className="flex flex-col gap-2">
                            <Select
                              value={quickDraft.comisionCurrency}
                              onValueChange={(value) =>
                                setQuickEditForm((current) => ({
                                  ...current,
                                  [quickEditKey]: {
                                    ...quickDraft,
                                    comisionCurrency: value as CurrencyCode,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-full min-w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ARS">$ (ARS)</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              value={quickDraft.comision}
                              onChange={(event) =>
                                setQuickEditForm((current) => ({
                                  ...current,
                                  [quickEditKey]: {
                                    ...quickDraft,
                                    comision: Number(event.target.value),
                                  },
                                }))
                              }
                              className="w-full min-w-32 text-center"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="min-w-36 align-middle">
                          <div className="flex flex-col gap-2">
                            <Select
                              value={quickDraft.gastosCurrency}
                              onValueChange={(value) =>
                                setQuickEditForm((current) => ({
                                  ...current,
                                  [quickEditKey]: {
                                    ...quickDraft,
                                    gastosCurrency: value as CurrencyCode,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 w-full min-w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ARS">$ (ARS)</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={0}
                              value={quickDraft.gastos}
                              onChange={(event) =>
                                setQuickEditForm((current) => ({
                                  ...current,
                                  [quickEditKey]: {
                                    ...quickDraft,
                                    gastos: Number(event.target.value),
                                  },
                                }))
                              }
                              className="w-full min-w-32 text-center"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="min-w-32 align-middle">
                          <div className="flex h-9 items-center justify-center text-sm text-foreground">
                            {formatPrice(quickDraft.price)}
                          </div>
                        </TableCell>
                        <TableCell className="align-middle">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={`${quickDraft.discount}%`}
                            onChange={(event) =>
                              setQuickEditForm((current) => ({
                                ...current,
                                [quickEditKey]: {
                                  ...quickDraft,
                                  discount: Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      Number(event.target.value.replace(/[^0-9.]/g, "")) || 0,
                                    ),
                                  ),
                                },
                              }))
                            }
                            className="w-24 border-0 bg-transparent px-0 text-center text-foreground shadow-none"
                          />
                        </TableCell>
                        <TableCell className="align-middle">
                          {formatPrice(
                            Math.max(0, quickDraft.price * (1 - quickDraft.discount / 100)),
                          )}
                        </TableCell>
                        <TableCell className="align-middle">
                          {formatPrice(
                            quickDraft.price * (1 - quickDraft.discount / 100) - quickDraft.gastos,
                          )}
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="min-w-64 text-center">
                          <div className="flex min-w-0 flex-wrap items-center justify-center gap-2 text-left">
                            <span className="min-w-0 wrap-break-word font-medium">
                              {product.name}
                            </span>
                            {variant ? (
                              <span className="inline-flex items-center text-[10px] uppercase tracking-wider">
                                <span className="rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
                                  {variant.name}
                                </span>
                              </span>
                            ) : null}
                            {(variant ? Boolean(variant.hidden) : Boolean(product.hidden)) ? (
                              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                Oculto
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getBrandShortName(product.brand)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              displayStock === "∞"
                                ? "success"
                                : Number(displayStock) === 0
                                  ? "destructive"
                                  : Number(displayStock) <= 4
                                    ? "warning"
                                    : "success"
                            }
                          >
                            {displayStock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {formatPrice(displayComision, displayComisionCurrency)}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatPrice(displayGastos, displayGastosCurrency)}
                        </TableCell>
                        <TableCell className="text-center">{formatPrice(displayPrice)}</TableCell>
                        <TableCell
                          className="text-center"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Input
                            type="text"
                            value={`${pendingDiscounts[product.id] || discount}%`}
                            placeholder="0%"
                            className="w-24 border-0 bg-transparent px-0 text-center shadow-none"
                            readOnly
                            tabIndex={-1}
                            onFocus={(e) => (e.currentTarget as HTMLInputElement).blur()}
                            onMouseDown={(e) => e.preventDefault()}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {formatPrice(Math.max(0, discountedPrice))}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatPrice(displayProfit, displayProfitCurrency)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
              {results.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron productos.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPage(0)}
            disabled={!hasPreviousPage}
            className="h-9 rounded-xl border border-input bg-[#1f2937] px-4 text-sm text-white shadow-none hover:bg-[#111827]"
          >
            Principio
          </Button>
          <div className="flex items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`h-9 min-w-9 rounded-xl border border-input px-3 py-1.5 text-sm outline-none transition-colors focus-visible:outline-none ${index === page ? "bg-[#1f2937] text-white shadow-none" : "bg-transparent text-muted-foreground hover:bg-surface-2"}`}
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setPage(totalPages - 1)}
            disabled={!hasNextPage}
            className="h-9 rounded-xl border border-input bg-[#1f2937] px-4 text-sm text-white shadow-none hover:bg-[#111827]"
          >
            Último
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="text-sm text-muted-foreground">Mostrar</div>
          <Input
            type="number"
            min={1}
            max={1000}
            value={pageSizeInput}
            placeholder="Cantidad"
            onChange={(e) => setPageSizeInput(e.target.value)}
            className="h-8 w-20 bg-background/50"
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
                className="h-8 px-4"
              >
                <Check className="mr-2 h-4 w-4" />
                Confirmar
              </Button>
            );
          })()}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {visibleResults.length} de {results.length} productos mostrados
        </p>
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

      <input
        ref={textProductInputRef}
        type="file"
        accept=".txt,.csv,.tsv,.xlsx,.xls"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0] ?? null;
          await handleImportTextProduct(file);
          event.target.value = "";
        }}
      />

      <Dialog open={createChoiceOpen} onOpenChange={setCreateChoiceOpen}>
        <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle>Crear producto</DialogTitle>
            <DialogDescription>
              Elegí cómo quieres añadir nuevos productos al catálogo.
            </DialogDescription>
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
                textProductInputRef.current?.click();
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>Importar desde un archivo de texto</span>
                <span className="text-xs text-muted-foreground">Abrir archivo del dispositivo</span>
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

      <Dialog
        open={importCategoryOpen}
        onOpenChange={(open) => {
          setImportCategoryOpen(open);
          if (!open) setPendingImportedProducts([]);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar productos importados</DialogTitle>
            <DialogDescription>
              Se crearán {pendingImportedProducts.length} productos, uno por cada imagen. Elegí la
              tienda y la categoría que tendrán.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-brand">Tienda</Label>
              <Select
                value={importBrand}
                onValueChange={(value) => {
                  const nextBrand = value as BrandSlug;
                  setImportBrand(nextBrand);
                  setImportCategory(brands[nextBrand].categories[0]?.slug ?? "");
                  setImportSubcategory("");
                }}
              >
                <SelectTrigger id="import-brand">
                  <SelectValue placeholder="Seleccioná una tienda" />
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
              <Label htmlFor="import-category">Categoría</Label>
              <Select
                value={importCategory}
                onValueChange={(value) => {
                  setImportCategory(value);
                  setImportSubcategory("");
                }}
              >
                <SelectTrigger id="import-category">
                  <SelectValue placeholder="Seleccioná una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {importCategories.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedImportCategory?.subcategories?.length ? (
              <div className="space-y-2">
                <Label htmlFor="import-subcategory">Subcategoría</Label>
                <Select value={importSubcategory} onValueChange={setImportSubcategory}>
                  <SelectTrigger id="import-subcategory">
                    <SelectValue placeholder="Opcional: seleccioná una subcategoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedImportCategory.subcategories.map((subcategory) => (
                      <SelectItem key={subcategory.slug} value={subcategory.slug}>
                        {subcategory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportCategoryOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleConfirmMultipleImport} disabled={!importCategory}>
              Crear productos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductEditDialog
        open={createDialogOpen}
        onOpenChange={(open) => (open ? setCreateDialogOpen(true) : closeProductEditor())}
        mode="create"
        productForm={productForm}
        setProductForm={setProductForm}
        configuredUsdRate={usdRate}
        initialVariantId={null}
        bulkEditPosition={-1}
        bulkEditCount={0}
        onNavigateBulkEdit={() => {}}
        onSave={handleSaveProduct}
        isSaving={isSavingProduct}
        supplierProducts={products}
      />
      <ProductEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => (open ? setEditDialogOpen(true) : closeProductEditor())}
        mode="edit"
        productForm={productForm}
        setProductForm={setProductForm}
        configuredUsdRate={usdRate}
        initialVariantId={initialVariantId}
        bulkEditPosition={bulkEditQueue.length > 0 ? bulkEditPosition : -1}
        bulkEditCount={bulkEditQueue.length}
        onNavigateBulkEdit={navigateBulkEditProduct}
        onSave={handleSaveProduct}
        isSaving={isSavingProduct}
        onDelete={
          editingProduct
            ? () => {
                const productId = editingProduct.id;
                const variantId = initialVariantId ?? undefined;
                setConfirmState({
                  open: true,
                  title: variantId ? "¿Eliminar variante?" : "¿Eliminar producto?",
                  description: variantId
                    ? "La variante se quitará del producto."
                    : "El producto se enviará a la papelera.",
                  confirmLabel: "Eliminar",
                  onConfirm: () => {
                    void handleDeleteProduct(productId, variantId).then(() => closeProductEditor());
                  },
                });
              }
            : undefined
        }
        supplierProducts={products}
      />
      <Dialog open={usdRatePromptOpen} onOpenChange={setUsdRatePromptOpen}>
        <DialogContent
          className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
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
                  placeholder="Escribir valor USD"
                  className="h-11 text-base"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setUsdRatePromptOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleUsdRateConfirm}>
                <Save className="mr-2 size-4" /> Guardar valor
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
        confirmLabel={confirmState.confirmLabel ?? "Sí"}
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
  isSaving,
  onDelete,
  supplierProducts,
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
  isSaving: boolean;
  onDelete?: () => void;
  supplierProducts: Product[];
}) {
  const [newFeature, setNewFeature] = useState("");
  const [newInclude, setNewInclude] = useState("");
  const [editingFeatureIndex, setEditingFeatureIndex] = useState<number | null>(null);
  const [editingIncludeIndex, setEditingIncludeIndex] = useState<number | null>(null);
  const [inlineFeatureText, setInlineFeatureText] = useState("");
  const [inlineIncludeText, setInlineIncludeText] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const initialFormRef = useRef<string | null>(null);
  const productFormRef = useRef<ProductFormState | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variantNameDraft, setVariantNameDraft] = useState("");
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [inlineVariantName, setInlineVariantName] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [descriptionConfirmed, setDescriptionConfirmed] = useState(true);
  const descriptionInitialRef = useRef("");
  const descriptionAppliedRef = useRef("");
  const featuresAppliedRef = useRef("");
  const includesAppliedRef = useRef("");
  const [supplierOptions, setSupplierOptions] = useState<ProductSupplier[]>([]);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState<ProductSupplier>({
    name: "",
    phone: "",
    social: "",
    purchaseDate: "",
  });

  useEffect(() => {
    productFormRef.current = productForm;
  }, [productForm]);

  useEffect(() => {
    const productSuppliers = supplierProducts
      .flatMap((product) => [
        product.supplier,
        ...(product.variants ?? []).map((variant) => variant.supplier),
      ])
      .filter((supplier): supplier is ProductSupplier =>
        Boolean(supplier?.name || supplier?.phone || supplier?.social),
      );
    const unique = new Map<string, ProductSupplier>();
    productSuppliers.forEach((supplier) => unique.set(getSupplierKey(supplier), supplier));
    void loadAdminSettings({ data: {} }).then((settings) => {
      const deletedSetting = settings.find(
        (setting) => setting.settingKey === DELETED_SUPPLIERS_STORAGE_KEY,
      );
      let deletedKeys: string[] = [];
      if (deletedSetting) {
        try {
          const parsed = JSON.parse(deletedSetting.settingValue) as unknown;
          deletedKeys = Array.isArray(parsed)
            ? parsed.filter((key): key is string => typeof key === "string")
            : [];
        } catch {
          deletedKeys = [];
        }
      }
      const stored = settings.find((setting) => setting.settingKey === "lrg:suppliers");
      if (stored) {
        try {
          const suppliers = JSON.parse(stored.settingValue) as ProductSupplier[];
          suppliers.forEach((supplier) => unique.set(getSupplierKey(supplier), supplier));
        } catch {
          // Ignore malformed persisted supplier data.
        }
      }
      setSupplierOptions(
        Array.from(unique.values()).filter(
          (supplier) => !deletedKeys.includes(getSupplierKey(supplier)),
        ),
      );
    });
  }, [supplierProducts]);

  const selectSupplier = (value: string) => {
    if (!productForm) return;
    if (value === "add") {
      setNewSupplier({ name: "", phone: "", social: "", purchaseDate: "" });
      setNewSupplierOpen(true);
      return;
    }
    if (value === "none") {
      const emptySupplier: ProductSupplier = {
        name: "",
        phone: "",
        social: "",
        purchaseDate: "",
      };
      setProductForm({
        ...productForm,
        ...(activeVariant
          ? {
              variants: productForm.variants.map((variant) =>
                variant.id === activeVariant.id ? { ...variant, supplier: emptySupplier } : variant,
              ),
            }
          : { supplier: emptySupplier }),
      });
      return;
    }
    const selectedSupplier = supplierOptions.find((supplier) => getSupplierKey(supplier) === value);
    if (selectedSupplier) {
      const supplier = { ...selectedSupplier, purchaseDate: activeSupplier.purchaseDate };
      setProductForm({
        ...productForm,
        ...(activeVariant
          ? {
              variants: productForm.variants.map((variant) =>
                variant.id === activeVariant.id ? { ...variant, supplier } : variant,
              ),
            }
          : { supplier }),
      });
    }
  };

  const addSupplierFromProduct = () => {
    const supplier = {
      name: newSupplier.name.trim(),
      phone: newSupplier.phone.trim(),
      social: newSupplier.social.trim(),
      purchaseDate: "",
    };
    if (!supplier.name || !supplier.phone || !supplier.social) return;
    const next = [...supplierOptions, supplier];
    setSupplierOptions(next);
    void saveAdminSetting({
      data: { settingKey: "lrg:suppliers", settingValue: JSON.stringify(next) },
    });
    if (productForm) {
      setProductForm({
        ...productForm,
        ...(activeVariant
          ? {
              variants: productForm.variants.map((variant) =>
                variant.id === activeVariant.id ? { ...variant, supplier } : variant,
              ),
            }
          : { supplier }),
      });
    }
    setNewSupplierOpen(false);
  };

  useEffect(() => {
    if (!open) {
      initialFormRef.current = null;
      return;
    }

    const currentProductForm = productFormRef.current;
    if (currentProductForm) {
      initialFormRef.current = JSON.stringify(currentProductForm);
      setSelectedVariantId(initialVariantId ?? currentProductForm.variants[0]?.id ?? null);
    }
  }, [open, initialVariantId, productForm?.id]);

  useEffect(() => {
    const currentProductForm = productFormRef.current;
    if (!currentProductForm) return;
    const selectedVariant = currentProductForm.variants.find(
      (variant) => variant.id === selectedVariantId,
    );
    const description = selectedVariant?.description ?? currentProductForm.description;
    setDescriptionDraft(description);
    setDescriptionConfirmed(true);
    descriptionInitialRef.current = description;
    descriptionAppliedRef.current = description;
    featuresAppliedRef.current = JSON.stringify(
      selectedVariant?.features ?? currentProductForm.features,
    );
    includesAppliedRef.current = JSON.stringify(
      selectedVariant?.includes ?? currentProductForm.includes,
    );
  }, [open, productForm?.id, selectedVariantId]);

  const hasChanges = useMemo(
    () =>
      productForm && initialFormRef.current !== null
        ? JSON.stringify(productForm) !== initialFormRef.current
        : false,
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

  const handleAddInclude = () => {
    if (!productForm) return;
    const include = newInclude.trim();
    if (!include) return;

    setProductForm({
      ...productForm,
      ...(activeVariant
        ? {
            variants: productForm.variants.map((variant) =>
              variant.id === activeVariant.id
                ? { ...variant, includes: [...activeIncludes, include] }
                : variant,
            ),
          }
        : { includes: [...activeIncludes, include] }),
    });
    setNewInclude("");
  };

  const handleDeleteInclude = (index: number) => {
    if (!productForm) return;
    setProductForm({
      ...productForm,
      ...(activeVariant
        ? {
            variants: productForm.variants.map((variant) =>
              variant.id === activeVariant.id
                ? {
                    ...variant,
                    includes: activeIncludes.filter((_, itemIndex) => itemIndex !== index),
                  }
                : variant,
            ),
          }
        : { includes: activeIncludes.filter((_, itemIndex) => itemIndex !== index) }),
    });
  };

  const handleSaveInclude = () => {
    if (!productForm || editingIncludeIndex === null) return;
    const include = inlineIncludeText.trim();
    if (!include) return;
    const nextIncludes = activeIncludes.map((item, index) =>
      index === editingIncludeIndex ? include : item,
    );
    setProductForm({
      ...productForm,
      ...(activeVariant
        ? {
            variants: productForm.variants.map((variant) =>
              variant.id === activeVariant.id ? { ...variant, includes: nextIncludes } : variant,
            ),
          }
        : { includes: nextIncludes }),
    });
    setEditingIncludeIndex(null);
    setInlineIncludeText("");
  };

  const applyIncludesToAllVariants = () => {
    if (!productForm || !activeVariant) return;
    setProductForm({
      ...productForm,
      variants: productForm.variants.map((variant) => ({
        ...variant,
        includes: [...activeIncludes],
      })),
    });
    includesAppliedRef.current = JSON.stringify(activeIncludes);
    toast.success("Incluye aplicado a todas las variantes");
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
                ? {
                    ...variant,
                    features: activeFeatures.map((item, index) =>
                      index === editingFeatureIndex ? feature : item,
                    ),
                  }
                : variant,
            ),
          }
        : {
            features: activeFeatures.map((item, index) =>
              index === editingFeatureIndex ? feature : item,
            ),
          }),
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

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("No se pudo convertir la imagen seleccionada a datos persistibles."));
        }
      };
      reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(file);
    });

  const requestUsdRateForCurrency = (
    field: "priceCurrency" | "comisionCurrency" | "gastosCurrency",
    nextCurrency: CurrencyCode,
  ) => {
    if (!productForm) return;

    setProductForm({
      ...productForm,
      [field]: nextCurrency,
      usdRate:
        nextCurrency === "USD" && configuredUsdRate > 0 ? configuredUsdRate : productForm.usdRate,
    });
  };

  const handleAddImageFiles = async (files: FileList | null) => {
    if (!productForm || !files?.length) return;

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const imageDataUrls = await Promise.all(
      imageFiles.map(async (file) => cropImageDataUrl(await fileToDataUrl(file))),
    );

    setProductForm({
      ...productForm,
      images: [...productForm.images, ...imageDataUrls],
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
      includes: productForm.includes,
      deliveryUnit: productForm.deliveryUnit === "" ? undefined : productForm.deliveryUnit,
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
      setSelectedVariantId(
        productForm.variants[index + 1]?.id ?? productForm.variants[index - 1]?.id ?? null,
      );
    }
    if (editingVariantIndex === index) handleCancelVariantEdit();
  };

  const activeVariant = productForm?.variants.find((variant) => variant.id === selectedVariantId);
  const activeSupplier = activeVariant?.supplier ??
    productForm?.supplier ?? { name: "", phone: "", social: "", purchaseDate: "" };
  const activeFeatures = activeVariant?.features ?? productForm?.features ?? [];
  const activeIncludes = activeVariant?.includes ?? productForm?.includes ?? [];
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

  if (!productForm) return null;

  const canApplyDescription =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    descriptionConfirmed &&
    descriptionDraft !== descriptionAppliedRef.current;
  const canApplyFeatures =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    JSON.stringify(activeFeatures) !== featuresAppliedRef.current;
  const canApplyIncludes =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    JSON.stringify(activeIncludes) !== includesAppliedRef.current;

  const confirmDescription = () => {
    if (!productForm || descriptionDraft === descriptionInitialRef.current) return;
    updateActiveVariant({ description: descriptionDraft });
    setDescriptionConfirmed(true);
    descriptionInitialRef.current = descriptionDraft;
  };

  const isNewProduct = mode === "create";
  const canSave = isNewProduct || hasChanges;
  const modeTitle = isNewProduct ? "Nuevo producto" : "Editar producto";
  const modeDescription = isNewProduct
    ? "Agregá un producto completo con nombre, stock, precio y categoría."
    : "Actualizá los datos del producto sin afectar el flujo de alta.";
  const safeBrandForForm = productForm.brand || "arcade";
  const availableCategories = productForm.brand
    ? brands[safeBrandForForm as BrandSlug].categories.map((category) => ({
        ...category,
        brandSlug: safeBrandForForm as BrandSlug,
        brandName: brands[safeBrandForForm as BrandSlug].name,
      }))
    : brandList.flatMap((brand) =>
        brand.categories.map((category) => ({
          ...category,
          brandSlug: brand.slug,
          brandName: brand.name,
        })),
      );
  const availableSubcategories =
    availableCategories.find((category) => category.slug === productForm.category)?.subcategories ??
    [];
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
    usdRate > 0
      ? `Tipo de cambio USD: 1 USD = ${formatPrice(usdRate)}`
      : "Ingresá el valor de 1 USD para convertir";
  const showUsdRateInput =
    productForm.priceCurrency === "USD" ||
    productForm.comisionCurrency === "USD" ||
    productForm.gastosCurrency === "USD";
  const activeCommission = activeVariant?.comision ?? productForm.comision;
  const activeCommissionCurrency = activeVariant?.comisionCurrency ?? productForm.comisionCurrency;
  const activeExpenses = activeVariant?.gastos ?? productForm.gastos;
  const activeExpensesCurrency = activeVariant?.gastosCurrency ?? productForm.gastosCurrency;
  const activeDiscount = activeVariant?.discount ?? productForm.discount;
  const activeStock = activeVariant?.stock ?? productForm.stock;
  const activeStockUnlimited = activeVariant?.stockUnlimited ?? productForm.stockUnlimited;
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
  const activeDiscountValue = activePriceValue * (activeDiscount / 100);
  const activeStorePrice = activePriceValue - activeDiscountValue;
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
    const commissionLocal = toLocalCurrency(
      nextVariant.comision ?? 0,
      nextVariant.comisionCurrency ?? "ARS",
    );
    const expensesLocal = toLocalCurrency(
      nextVariant.gastos ?? 0,
      nextVariant.gastosCurrency ?? "ARS",
    );
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
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-5xl max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto rounded-3xl border border-border/60 bg-background p-4 pr-2 shadow-2xl md:[scrollbar-width:thin] md:[&::-webkit-scrollbar]:block md:[&::-webkit-scrollbar]:w-2 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 sm:w-[calc(100vw-2rem)] sm:p-6"
        style={{ scrollbarGutter: "stable" }}
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>{modeTitle}</DialogTitle>
            {hasBulkNavigation ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateBulkEdit(-1)}
                  disabled={!canNavigatePrevious}
                  aria-label="Producto anterior"
                >
                  <ArrowLeft className="size-4" /> Anterior
                </Button>
                <span>
                  {bulkEditPosition + 1} / {bulkEditCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateBulkEdit(1)}
                  disabled={!canNavigateNext}
                  aria-label="Producto siguiente"
                >
                  Siguiente <ArrowRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>
          <DialogDescription>{modeDescription}</DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="order-1 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {isNewProduct ? "Alta" : "Edición"}
              </span>
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
                      subcategory: "",
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
                    const selectedCategory = availableCategories.find(
                      (category) => category.slug === value,
                    );
                    setProductForm({
                      ...productForm,
                      brand: productForm.brand || selectedCategory?.brandSlug || "",
                      category: value,
                      subcategory: "",
                    });
                  }}
                >
                  <SelectTrigger id="new-category" className="w-full">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map((category) => (
                      <SelectItem key={category.slug} value={category.slug}>
                        {productForm.brand
                          ? category.name
                          : `${category.name} (${category.brandName})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {productForm.category && (
                <div className="space-y-2">
                  <Label htmlFor="new-subcategory">Subcategoría</Label>
                  <Select
                    disabled={availableSubcategories.length === 0}
                    value={productForm.subcategory}
                    onValueChange={(value) =>
                      setProductForm({ ...productForm, subcategory: value })
                    }
                  >
                    <SelectTrigger id="new-subcategory" className="w-full">
                      <SelectValue
                        placeholder={
                          availableSubcategories.length
                            ? "Seleccionar subcategoría"
                            : "Sin subcategorías"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSubcategories.map((subcategory) => (
                        <SelectItem key={subcategory.slug} value={subcategory.slug}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!productForm.id && showUsdRateInput && (
                <>
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
                            placeholder="Escribir valor USD"
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
                </>
              )}
            </div>
          </div>

          <div className="order-3 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Precios
              </span>
            </div>
            {activeUsdRequired && (
              <div className="mb-4 rounded-xl border border-amber-500/35 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                {conversionHint}
              </div>
            )}
            <div className="grid items-start gap-4 sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <Label>Mi comisión</Label>
                  <Select
                    value={activeCommissionCurrency}
                    onValueChange={(value) =>
                      updateActivePricing({ comisionCurrency: value as CurrencyCode })
                    }
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">$ (ARS)</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  value={isNewProduct && activeCommission === 0 ? "" : activeCommission}
                  onChange={(event) =>
                    updateActivePricing({
                      comision: event.target.value === "" ? 0 : Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <Label>Gastos</Label>
                  <Select
                    value={activeExpensesCurrency}
                    onValueChange={(value) =>
                      updateActivePricing({ gastosCurrency: value as CurrencyCode })
                    }
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">$ (ARS)</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  value={activeExpenses === 0 ? "" : activeExpenses}
                  onChange={(event) =>
                    updateActivePricing({
                      gastos: event.target.value === "" ? 0 : Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <Label>Precio</Label>
                  <span className="text-xs text-muted-foreground">{activeOutputCurrency}</span>
                </div>
                <div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm opacity-80">
                  {formatLockedNumber(activePriceValue)}
                </div>
              </div>
            </div>
            <div className="mt-4 grid items-start gap-4 sm:grid-cols-3">
              <div className="flex min-w-0 flex-col gap-1">
                <Label className="min-h-8">Descuento (%)</Label>
                <Input
                  type="number"
                  value={activeDiscount === 0 ? "" : activeDiscount}
                  onChange={(event) =>
                    updateActiveVariant({
                      discount: event.target.value === "" ? 0 : Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <Label>Precio tienda</Label>
                  <span className="text-xs text-muted-foreground">{activeOutputCurrency}</span>
                </div>
                <div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm opacity-80">
                  {formatLockedNumber(activeStorePrice)}
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <Label>Ganancias</Label>
                  <span className="text-xs text-muted-foreground">{activeOutputCurrency}</span>
                </div>
                <div className="flex h-9 cursor-not-allowed items-center rounded-md border border-input bg-muted/20 px-3 text-sm opacity-80">
                  {formatLockedNumber(activeProfit)}
                </div>
              </div>
            </div>
            <div className="mt-4 grid items-start gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1">
                <Label className="min-h-8">Stock</Label>
                <div
                  className={`grid gap-2 ${activeStockUnlimited ? "grid-cols-1" : "grid-cols-2"}`}
                >
                  <Select
                    value={activeStockUnlimited ? "unlimited" : "limited"}
                    onValueChange={(value) =>
                      updateActiveVariant({ stockUnlimited: value === "unlimited" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="limited">Cantidad</SelectItem>
                      <SelectItem value="unlimited">Ilimitado</SelectItem>
                    </SelectContent>
                  </Select>
                  {!activeStockUnlimited && (
                    <Input
                      type="number"
                      min={0}
                      value={activeStock === 0 ? "" : activeStock}
                      onChange={(event) =>
                        updateActiveVariant({ stock: Number(event.target.value) || 0 })
                      }
                    />
                  )}
                </div>
              </div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-3">
                <div
                  className={`flex min-w-0 flex-col gap-1 ${showsDeliveryDetails ? "" : "sm:col-span-3"}`}
                >
                  <Label className="min-h-8">Tiempo de entrega</Label>
                  <Select
                    value={activeDeliveryUnit}
                    onValueChange={(value) =>
                      updateActiveVariant({ deliveryUnit: value as DeliveryUnit })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inmediata">Entrega inmediata</SelectItem>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="dias">Días</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {showsDeliveryDetails && (
                  <>
                    <div className="flex min-w-0 flex-col gap-1">
                      <Label className="min-h-8">Cantidad</Label>
                      <Input
                        type="number"
                        min={1}
                        value={activeDeliveryAmount === 0 ? "" : activeDeliveryAmount}
                        onChange={(event) =>
                          updateActiveVariant({ deliveryAmount: Number(event.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <Label className="min-h-8">Entrega</Label>
                      <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm opacity-60">
                        {activeDeliveryAmount > 0
                          ? `${activeDeliveryAmount} ${activeDeliveryUnit}`
                          : ""}
                      </div>
                    </div>
                  </>
                )}
              </div>
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
                    <div
                      key={variant.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-input p-3"
                    >
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
                              disabled={
                                !inlineVariantName.trim() ||
                                inlineVariantName.trim() === variant.name
                              }
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
                            <button
                              type="button"
                              className="min-w-0 truncate text-left text-sm font-medium"
                              onClick={() => setSelectedVariantId(variant.id)}
                            >
                              {variant.name}
                            </button>
                            {selectedVariantId === variant.id && (
                              <Badge className="shrink-0 border-emerald-300 bg-emerald-500 text-black">
                                Activa
                              </Badge>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant={selectedVariantId === variant.id ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => setSelectedVariantId(variant.id)}
                              className="h-8 gap-2 px-3 text-sm"
                              disabled={selectedVariantId === variant.id}
                            >
                              {selectedVariantId === variant.id ? "Seleccionado" : "Seleccionar"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartVariantEdit(index)}
                              className="h-8 gap-2 px-3 text-sm"
                            >
                              <Pencil className="size-4" /> Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVariant(index)}
                              className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                            >
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
                <Select
                  value={
                    getSupplierKey(activeSupplier) === "||"
                      ? "none"
                      : getSupplierKey(activeSupplier)
                  }
                  onValueChange={selectSupplier}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {supplierOptions.map((supplier) => (
                      <SelectItem key={getSupplierKey(supplier)} value={getSupplierKey(supplier)}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="add">Agregar proveedor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Label>Celular</Label>
                <Input value={activeSupplier.phone} readOnly />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Label>Red social</Label>
                <Input value={activeSupplier.social} readOnly />
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Label>Fecha de compra</Label>
                <Input
                  type="date"
                  value={activeSupplier.purchaseDate}
                  onChange={(event) => {
                    const supplier = { ...activeSupplier, purchaseDate: event.target.value };
                    setProductForm({
                      ...productForm,
                      ...(activeVariant
                        ? {
                            variants: productForm.variants.map((variant) =>
                              variant.id === activeVariant.id ? { ...variant, supplier } : variant,
                            ),
                          }
                        : { supplier }),
                    });
                  }}
                  className="[&::-webkit-calendar-picker-indicator]:invert"
                />
              </div>
            </div>
          </div>

          <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo proveedor</DialogTitle>
                <DialogDescription>Ingresá los datos del nuevo proveedor.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="product-supplier-name">Nombre</Label>
                  <Input
                    id="product-supplier-name"
                    value={newSupplier.name}
                    onChange={(event) =>
                      setNewSupplier((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-supplier-phone">Celular</Label>
                  <Input
                    id="product-supplier-phone"
                    value={newSupplier.phone}
                    onChange={(event) =>
                      setNewSupplier((current) => ({ ...current, phone: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product-supplier-social">Red social</Label>
                  <Input
                    id="product-supplier-social"
                    value={newSupplier.social}
                    onChange={(event) =>
                      setNewSupplier((current) => ({ ...current, social: event.target.value }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setNewSupplierOpen(false)}>
                  <X className="size-4" /> Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={addSupplierFromProduct}
                  disabled={
                    !newSupplier.name.trim() ||
                    !newSupplier.phone.trim() ||
                    !newSupplier.social.trim()
                  }
                >
                  <Save className="size-4" /> Guardar proveedor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="order-4 rounded-2xl border border-border/60 bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Características
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  id="new-feature"
                  className="flex-1"
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
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleAddFeature} className="whitespace-nowrap">
                    <Plus className="h-4 w-4" /> Agregar
                  </Button>
                  <label className="inline-flex h-9 min-w-[13rem] shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-2xl border border-border/60 bg-background/80 px-3 py-1">
                    <span className="text-[11px] leading-none sm:text-sm">
                      Aplicar a todas las variantes
                    </span>
                    <Switch
                      checked={false}
                      onCheckedChange={(checked) => {
                        if (checked) applyFeaturesToAllVariants();
                      }}
                      disabled={!canApplyFeatures}
                      aria-label="Aplicar características a todas las variantes"
                    />
                  </label>
                </div>
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
                                inlineFeatureText.trim() ===
                                  (activeFeatures[editingFeatureIndex] ?? "") ||
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
              <div className="mt-5 border-t border-border/50 pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Incluye
                  </span>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Input
                    id="new-include"
                    className="flex-1"
                    value={newInclude}
                    onChange={(event) => setNewInclude(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddInclude();
                      }
                    }}
                    placeholder="Escribir qué incluye"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleAddInclude} className="whitespace-nowrap">
                      <Plus className="h-4 w-4" /> Agregar
                    </Button>
                    <label className="inline-flex h-9 shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-2xl border border-border/60 bg-background/80 px-3 py-1">
                      <span className="text-[11px] leading-none sm:text-sm">
                        Aplicar a todas las variantes
                      </span>
                      <Switch
                        checked={false}
                        onCheckedChange={(checked) => {
                          if (checked) applyIncludesToAllVariants();
                        }}
                        disabled={!canApplyIncludes}
                        aria-label="Aplicar incluye a todas las variantes"
                      />
                    </label>
                  </div>
                </div>
                {activeIncludes.length > 0 && (
                  <div className="mt-2 grid gap-2">
                    {activeIncludes.map((include, index) => (
                      <div
                        key={`${include}-${index}`}
                        className="flex flex-col gap-2 rounded-lg border border-input px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        {editingIncludeIndex === index ? (
                          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Input
                              value={inlineIncludeText}
                              onChange={(event) => setInlineIncludeText(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleSaveInclude();
                                }
                              }}
                              className="flex-1"
                            />
                            <div className="flex items-center gap-2">
                              <Button type="button" size="sm" onClick={handleSaveInclude}>
                                <Check className="h-4 w-4" /> Guardar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingIncludeIndex(null)}
                              >
                                <X className="h-4 w-4" /> Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span className="truncate">{include}</span>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-2 px-3 text-sm"
                                onClick={() => {
                                  setEditingIncludeIndex(index);
                                  setInlineIncludeText(include);
                                }}
                              >
                                <Pencil className="h-4 w-4" /> Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteInclude(index)}
                                aria-label={`Eliminar incluye ${index + 1}`}
                              >
                                <Trash2 className="h-4 w-4" /> Eliminar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-5 border-t border-border/50 pt-4">
                <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Descripción
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Textarea
                    value={descriptionDraft}
                    rows={3}
                    className="min-h-[90px] flex-1"
                    onChange={(event) => {
                      setDescriptionDraft(event.target.value);
                      setDescriptionConfirmed(false);
                    }}
                    placeholder="Descripción de esta variante"
                  />
                  <div className="flex w-full flex-col gap-2 sm:w-[15rem]">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={confirmDescription}
                      disabled={descriptionDraft === descriptionInitialRef.current}
                      className="h-10 w-full text-sm"
                    >
                      <Check className="mr-2 size-3.5" />
                      Confirmar
                    </Button>
                    <label className="inline-flex h-10 w-full items-center justify-between gap-2 whitespace-nowrap rounded-2xl border border-border/60 bg-background/80 px-3 py-1">
                      <span className="text-[11px] leading-none sm:text-sm">
                        Aplicar a todas las variantes
                      </span>
                      <Switch
                        checked={false}
                        onCheckedChange={(checked) => {
                          if (checked) applyDescriptionToAllVariants();
                        }}
                        disabled={!canApplyDescription}
                        aria-label="Aplicar descripción a todas las variantes"
                      />
                    </label>
                  </div>
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
                    <div
                      key={image + index}
                      className="rounded-2xl border border-input overflow-hidden"
                    >
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
          <div className="flex w-full items-center justify-between gap-2">
            <span />
            <div className="flex items-center gap-2">
            <div className="flex gap-2">
              {onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Trash2 className="size-4" /> Eliminar
                </Button>
              ) : null}
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
                disabled={isSaving}
                className="rounded-md border border-transparent bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80 hover:text-secondary-foreground hover:shadow-none"
                style={{ boxShadow: "none" }}
              >
                <X className="h-4 w-4 mr-2" /> Cancelar
              </Button>
              <Button
                variant="default"
                disabled={!canSave || isSaving}
                onClick={() => setConfirmSaveOpen(true)}
                className="rounded-md border border-transparent bg-primary text-primary-foreground shadow-none hover:bg-primary/90 hover:text-primary-foreground hover:shadow-none disabled:opacity-50"
                style={{ boxShadow: "none" }}
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Guardando..." : isNewProduct ? "Guardar producto" : "Guardar cambios"}
              </Button>
            </div>
            </div>
          </div>
        </DialogFooter>

        {hasBulkNavigation ? (
          <div className="mr-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigateBulkEdit(-1)}
              disabled={!canNavigatePrevious}
              aria-label="Producto anterior"
            >
              <ArrowLeft className="size-4" /> Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigateBulkEdit(1)}
              disabled={!canNavigateNext}
              aria-label="Producto siguiente"
            >
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
            if (isSaving) return;
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
