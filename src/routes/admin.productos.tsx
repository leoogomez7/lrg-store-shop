import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
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
  ImagePlus,
  LoaderCircle,
  ListPlus,
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
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { toast } from "sonner";
import {
  products as productsData,
  saveProduct,
  saveProductBatch,
  saveProducts,
  filterAdminProductsBySearch,
  type ProductSupplier,
  type ProductVariant,
} from "@/data/products";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { FilterChipList, type FilterChipItem } from "@/components/product/product-filters";
import {
  composeHeaderAboveImageDataUrl,
  cropImageDataUrl,
  optimizeImageDataUrl,
} from "@/lib/image-processing";
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
import { scrollToTopOnFirstSelection } from "@/lib/admin-selection";
import { parseQuickEditCommission } from "@/lib/quick-edit-utils";
import { catalogQueries, type Product } from "@/services/catalog.service";
import { moveToTrash } from "@/data/trash";
import {
  loadAdminAsset,
  loadAdminSettings,
  loadPlayStationProductImageDataUrl,
  saveAdminAsset,
  saveAdminSetting,
  deleteAdminProduct,
} from "@/server/persistence";
import {
  importPerfumeNotesWithAI,
  importPlayStationStoreCategory,
} from "@/server/persistence";
import {
  buildImportedProductsWithVariants,
  normalizeImportedVariantName,
  type ImportedVariantChoice,
} from "@/lib/product-import-variants";
import {
  parseDollarDelimitedProductLine,
  parseLocalizedImportPrice,
  replaceSubcategorySuffix,
} from "@/lib/product-import-utils";
import {
  removeSelectionFromQueue,
} from "@/lib/product-selection";

type DeliveryUnit = "inmediata" | "horas" | "dias";
type CurrencyCode = "ARS" | "USD";
type PerfumeNotesResult = {
  matched: boolean;
  title: string;
  description: string;
  reason: string;
  sources: { title: string; url: string }[];
};
type CategoryLabelNode = {
  slug: string;
  name: string;
  children?: CategoryLabelNode[];
};
type AdminCategoryFilterNode = {
  key: string;
  brand: BrandSlug;
  category: string;
  path: string[];
  label: string;
  children: AdminCategoryFilterNode[];
};
const getSubcategoryOptionsAtLevel = (
  nodes: CategoryLabelNode[] | undefined,
  selectedPath: string[],
  level: number,
) => {
  let currentNodes = nodes ?? [];
  for (let index = 0; index < level; index += 1) {
    const selectedNode = currentNodes.find((node) => node.slug === selectedPath[index]);
    currentNodes = selectedNode?.children ?? [];
  }
  return currentNodes;
};

type ProductFormState = {
  id: string;
  name: string;
  code: string;
  brand: BrandSlug | "";
  category: string;
  subcategory: string;
  subcategoryPath: string[];
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

type StoreImportProduct = {
  id: string;
  name: string;
  platforms: string[];
  basePrice?: string;
  discountedPrice?: string;
  discountText?: string;
  image?: string;
  lowestPrice: number;
};

const getPendingImportSignature = (products: Product[]) =>
  JSON.stringify(
    products.map((product) => ({
      ...product,
      images: (product.images ?? []).map((image) => {
        let hash = 2166136261;
        const stride = Math.max(1, Math.floor(image.length / 1024));
        for (let index = 0; index < image.length; index += stride) {
          hash = Math.imul(hash ^ image.charCodeAt(index), 16777619);
        }
        return `${image.length}:${hash >>> 0}`;
      }),
    })),
  );

const normalizeProductName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getImageImportProductName = (fileName: string, sequence: number) => {
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return baseName || `Producto importado ${sequence}`;
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
const PRODUCT_IMPORT_HEADER_ASSET_KEY = "product-import-header";
const UNASSIGNED_SUPPLIER_FILTER = "__unassigned__";
const UNASSIGNED_SKU_FILTER = "__unassigned_sku__";

const getBrandShortName = (brand: Product["brand"] | string | undefined) => {
  const brandKey = typeof brand === "string" ? brand : undefined;
  const brandConfig = brandKey ? brands[brandKey as BrandSlug] : undefined;

  if (brandConfig?.shortName) return brandConfig.shortName;
  if (brandKey) return brandKey;
  return "Sin marca";
};

const isProductRowHidden = (product: Product, variant?: ProductVariant) =>
  variant?.hidden ?? product.hidden ?? false;

export const Route = createFileRoute("/admin/productos")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(catalogQueries.allAdmin()),
      context.queryClient.ensureQueryData(catalogQueries.settings()),
    ]);
  },
  validateSearch: z.object({
    productId: z.string().optional(),
    variantId: z.string().optional(),
  }),
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
  const routeSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/admin/productos" });
  const queryClient = useQueryClient();
  const { data: products } = useSuspenseQuery(catalogQueries.allAdmin());
  const { data: adminSettings } = useSuspenseQuery(catalogQueries.settings());
  const [editableProducts, setEditableProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
    const [brandFilter, setBrandFilter] = useState<BrandSlug[]>(["arcade"]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const [skuFilter, setSkuFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyCode[]>(["ARS", "USD"]);
  const [priceMode, setPriceMode] = useState<"price" | "storePrice">("storePrice");
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [discountOnly, setDiscountOnly] = useState(false);
  const [stockOnly, setStockOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [hiddenOnly, setHiddenOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [suppliersOpen, setSuppliersOpen] = useState(false);
  const [skusOpen, setSkusOpen] = useState(false);
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
  const hasScrolledOnProductSelectionRef = useRef(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkEditQueue, setBulkEditQueue] = useState<string[]>([]);
  const [bulkQuickEditQueue, setBulkQuickEditQueue] = useState<string[]>([]);
  const [bulkEditPosition, setBulkEditPosition] = useState(0);
  const [isBulkEditSession, setIsBulkEditSession] = useState(false);
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
  const importHeaderInputRef = useRef<HTMLInputElement | null>(null);
  const appendImportedProductsRef = useRef(false);
  const additionalImagesInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const productHeaderInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [importHeaderImage, setImportHeaderImage] = useState("");
  const importHeaderImageRef = useRef("");
  const importHeaderSaveVersionRef = useRef(0);
  const [importProductHeaders, setImportProductHeaders] = useState<Record<string, string>>({});
  const [isImportHeaderLoaded, setIsImportHeaderLoaded] = useState(false);
  const [isSavingImportHeader, setIsSavingImportHeader] = useState(false);
  const [importImageViewer, setImportImageViewer] = useState<{
    image: string;
    label: string;
  } | null>(null);
  const [pendingImportedProducts, setPendingImportedProducts] = useState<Product[]>([]);
  const [applyingImportFieldsFromProductId, setApplyingImportFieldsFromProductId] =
    useState<string | null>(null);
  const [lastAppliedImportSignature, setLastAppliedImportSignature] = useState<string | null>(null);
  const pendingImportSignature = getPendingImportSignature(pendingImportedProducts);
  const [importCategoryOpen, setImportCategoryOpen] = useState(false);
  const [importBrand, setImportBrand] = useState<BrandSlug>("arcade");
  const [importCategory, setImportCategory] = useState("");
  const [importSubcategory, setImportSubcategory] = useState("");
  const [importSubcategoryPath, setImportSubcategoryPath] = useState<string[]>([]);
  const [importCode, setImportCode] = useState("");
  const [importAsVariant, setImportAsVariant] = useState(false);
  const [importVariantName, setImportVariantName] = useState("");
  const [applyImportFieldsToAll, setApplyImportFieldsToAll] = useState(true);
  const [importSetupOpen, setImportSetupOpen] = useState(false);
  const [importSetupSource, setImportSetupSource] = useState<"images" | "text" | "store" | null>(
    null,
  );
  const [importSource, setImportSource] = useState<"images" | "text" | "store" | null>(null);
  const [storeImportLink, setStoreImportLink] = useState("");
  const [storeImportPageMode, setStoreImportPageMode] = useState<"all" | "single" | "range">("all");
  const [storeImportPageNumber, setStoreImportPageNumber] = useState("1");
  const [storeImportPageEndNumber, setStoreImportPageEndNumber] = useState("2");
  const [isPreparingImport, setIsPreparingImport] = useState(false);
  const [isImportingStore, setIsImportingStore] = useState(false);
  const [isSavingImports, setIsSavingImports] = useState(false);
  const [importPreviewPage, setImportPreviewPage] = useState(0);
  const [storeImportPriceDetails, setStoreImportPriceDetails] = useState<
    Record<
      string,
      { regular?: string; offer?: string; discount?: string; platforms: string[]; image?: string }
    >
  >({});
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateCandidateIds, setDuplicateCandidateIds] = useState<string[]>([]);
  const [keepDuplicateIds, setKeepDuplicateIds] = useState<string[]>([]);
  const [importedVariantChoices, setImportedVariantChoices] = useState<
    Record<string, ImportedVariantChoice>
  >({});
  const [quickEditProductId, setQuickEditProductId] = useState<string | null>(null);
  const [quickEditVariantId, setQuickEditVariantId] = useState<string | null>(null);
  const [isSavingQuickEdit, setIsSavingQuickEdit] = useState(false);
  const [highlightedDeepLinkKey, setHighlightedDeepLinkKey] = useState<string | null>(null);
  const openedDeepLinkRef = useRef<string | null>(null);
  const highlightedDeepLinkRef = useRef<string | null>(null);

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
        comision: string;
        comisionCurrency: CurrencyCode;
        gastos: number;
        gastosCurrency: CurrencyCode;
        stock: number;
        stockUnlimited: boolean;
        discount: number;
      }
    >
  >({});
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const [page, setPage] = useState(0);
  // `pageSize` is the confirmed page size; default is 16 display rows per page
  const [pageSize, setPageSize] = useState<number>(16);
  // `pageSizeInput` is the editable input value the user types before confirming
  const [pageSizeInput, setPageSizeInput] = useState<string>("16");

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
    let active = true;
    void loadAdminAsset({ data: { assetKey: PRODUCT_IMPORT_HEADER_ASSET_KEY } })
      .then((image) => {
        if (
          active &&
          importHeaderSaveVersionRef.current === 0 &&
          image?.startsWith("data:image/")
        ) {
          importHeaderImageRef.current = image;
          setImportHeaderImage(image);
        }
      })
      .catch((error: unknown) => {
        console.error("No se pudo cargar la cabecera de importación:", error);
      })
      .finally(() => {
        if (active) setIsImportHeaderLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

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
    code: "",
    brand: "",
    category: "",
    subcategory: "",
    subcategoryPath: [],
    price: 0,
    priceCurrency: "ARS",
    comision: 0,
    comisionCurrency: "ARS",
    stock: 1,
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
        .replace(/\r\n?/g, "\n")
        .replace(/[–—]/g, "-")
        .split("\n")
        .map((line) => line.replace(/\t/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
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

        if (lineValue.includes("$")) {
          const dollarEntry = parseDollarDelimitedProductLine(lineValue);
          if (dollarEntry) entries.push(dollarEntry);
          continue;
        }

        const priceMatch = [...lineValue.matchAll(/(\d[\d.,]*)/g)]
          .map((match) => match[1] ?? "")
          .find((value) => parseLocalizedImportPrice(value) !== null);

        if (!priceMatch) continue;

        const priceValue = parseLocalizedImportPrice(priceMatch);
        if (priceValue === null) continue;

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

    const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";
    if (extension === "doc") {
      throw new Error(
        "El formato Word .doc antiguo no se puede leer directamente. Guardá el archivo como .docx e intentá de nuevo.",
      );
    }

    if (extension === "xlsx" || extension === "xls") {
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

    if (["docx", "pdf", "rtf", "odt", "ods"].includes(extension)) {
      const { OfficeParser } = await import("officeparser");
      const document = await OfficeParser.parseOffice(file, {
        pdfWorkerSrc: pdfWorkerUrl,
        pdfParserConfig: { extractTextColor: false },
      });
      const { value } = await document.to("text", {
        includeImages: false,
        textConfig: { preserveLayout: false, renderNotes: false },
      });
      if (typeof value !== "string") {
        throw new Error("No se pudo extraer texto utilizable del archivo.");
      }
      return parseEntriesFromText(value);
    }

    const textContent = await file.text();
    return parseEntriesFromText(textContent);
  };

  const handleImportTextProduct = async (file: File | null, append = false) => {
    if (!file) return;

    setIsPreparingImport(true);
    setImportCategoryOpen(true);

    let parsedProducts: Array<{ name: string; price: number }>;
    try {
      parsedProducts = await parseTextImportProducts(file);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo leer el archivo seleccionado.",
      );
      setIsPreparingImport(false);
      setImportCategoryOpen(false);
      return;
    }
    if (!parsedProducts.length) {
      toast.error(
        "No pude detectar productos con nombre y precio. Si el PDF es una imagen escaneada, necesitás un PDF con texto seleccionable.",
      );
      setIsPreparingImport(false);
      setImportCategoryOpen(false);
      return;
    }

    const subcategoryName = getSubcategoryPathLabel(
      importBrand,
      importCategory,
      importSubcategoryPath,
    );
    const importedProducts = parsedProducts.map(({ name: rawName, price }, index) => {
      const name = replaceSubcategorySuffix(rawName, "", subcategoryName);
      const slugBase =
        name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || `producto-importado-${Date.now()}-${index + 1}`;

      return {
        id: `import-text-${Date.now()}-${index + 1}`,
        slug: `${slugBase}-${index + 1}`,
        brand: importBrand,
        code: importCode.trim() || undefined,
        variantName: importAsVariant ? importVariantName.trim() : undefined,
        name,
        category: importCategory,
        subcategory: importSubcategoryPath[0] || undefined,
        subcategoryPath: importSubcategoryPath.length ? [...importSubcategoryPath] : undefined,
        price,
        priceCurrency: "ARS",
        gastos: 0,
        gastosCurrency: "ARS",
        comision: price,
        comisionCurrency: "ARS",
        stock: 1,
        stockUnlimited: false,
        deliveryUnit: "inmediata",
        deliveryAmount: 0,
        rating: 0,
        reviews: 0,
        short: "",
        description: "",
        features: [],
        images: [],
        createdAt: new Date().toISOString(),
      } as Product;
    });

    setCreateChoiceOpen(false);
    setPendingImportedProducts((current) =>
      append ? [...current, ...importedProducts] : importedProducts,
    );
    setImportSource("text");
    setImportBrand(importBrand);
    setImportCategory(importCategory);
    setImportSubcategory(importSubcategory);
    if (!append) setApplyImportFieldsToAll(true);
    setImportPreviewPage(append ? Math.floor(pendingImportedProducts.length / 30) : 0);
    setIsPreparingImport(false);
  };

  const handleImportMultipleProducts = async (files: FileList | null, append = false) => {
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(
      (file) =>
        file.type.startsWith("image/") ||
        /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(file.name),
    );
    if (imageFiles.length === 0) {
      toast.error("No se seleccionaron imágenes válidas.");
      return;
    }

    setIsPreparingImport(true);
    setImportCategoryOpen(true);
    let imageDataUrls: string[];
    try {
      imageDataUrls = await Promise.all(
        imageFiles.map(async (file) =>
          optimizeImageDataUrl(await cropImageDataUrl(await fileToDataUrl(file))),
        ),
      );
      imageDataUrls = await composeImportedImages(imageDataUrls);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron procesar las imágenes.");
      setIsPreparingImport(false);
      setImportCategoryOpen(false);
      return;
    }

    const subcategoryName = getSubcategoryPathLabel(
      importBrand,
      importCategory,
      importSubcategoryPath,
    );
    const importedProducts = imageFiles.map((file, index) => {
      const sequence = (append ? pendingImportedProducts.length : 0) + index + 1;
      const productName = replaceSubcategorySuffix(
        getImageImportProductName(file.name, sequence),
        "",
        subcategoryName,
      );
      const slugBase =
        productName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || `producto-importado-${Date.now()}-${index + 1}`;
      return {
        id: `import-${Date.now()}-${index + 1}`,
        slug: `${slugBase}-${index + 1}`,
        brand: importBrand,
        code: importCode.trim() || undefined,
        variantName: importAsVariant ? importVariantName.trim() : undefined,
        name: productName,
        category: importCategory,
        subcategory: importSubcategoryPath[0] || undefined,
        subcategoryPath: importSubcategoryPath.length ? [...importSubcategoryPath] : undefined,
        price: 0,
        priceCurrency: "ARS",
        gastos: 0,
        gastosCurrency: "ARS",
        comision: 5000,
        comisionCurrency: "ARS",
        stock: 1,
        stockUnlimited: false,
        deliveryUnit: "inmediata",
        deliveryAmount: 0,
        rating: 0,
        reviews: 0,
        short: "",
        description: "",
        features: [],
        images: [imageDataUrls[index]],
        createdAt: new Date().toISOString().slice(0, 10),
      } as Product;
    });

    setCreateChoiceOpen(false);
    setPendingImportedProducts((current) =>
      append ? [...current, ...importedProducts] : importedProducts,
    );
    setImportSource("images");
    setImportBrand(importBrand);
    setImportCategory(importCategory);
    setImportSubcategory(importSubcategory);
    if (!append) setApplyImportFieldsToAll(true);
    setImportPreviewPage(append ? Math.floor(pendingImportedProducts.length / 30) : 0);
    setIsPreparingImport(false);
  };

  const addMoreImportedProducts = () => {
    appendImportedProductsRef.current = true;
    if (importSource === "images") {
      multiProductInputRef.current?.click();
    } else if (importSource === "text") {
      textProductInputRef.current?.click();
    } else if (importSource === "store") {
      setImportCategoryOpen(false);
      setImportSetupSource("store");
      setImportSetupOpen(true);
    }
  };

  const importCategories = brands[importBrand].categories;
  const importSupplierOptions = useMemo(() => {
    const unique = new Map<string, ProductSupplier>();
    products.forEach((product) => {
      [product.supplier, ...(product.variants ?? []).map((variant) => variant.supplier)]
        .filter((supplier): supplier is ProductSupplier => Boolean(supplier?.name))
        .forEach((supplier) => unique.set(getSupplierKey(supplier), supplier));
    });
    const supplierSetting = adminSettings.find((setting) => setting.settingKey === "lrg:suppliers");
    if (supplierSetting) {
      try {
        const storedSuppliers = JSON.parse(supplierSetting.settingValue) as ProductSupplier[];
        storedSuppliers.forEach((supplier) => {
          if (supplier.name) unique.set(getSupplierKey(supplier), supplier);
        });
      } catch {
        // Ignore malformed supplier settings and keep suppliers found on products.
      }
    }
    const deletedSetting = adminSettings.find(
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
    return Array.from(unique.entries())
      .filter(([key]) => !deletedKeys.includes(key))
      .map(([, supplier]) => supplier);
  }, [adminSettings, products]);
  const selectedImportCategory = importCategories.find(
    (category) => category.slug === importCategory,
  );

  const effectiveUsdRate =
    usdRate ||
    (Number(
      adminSettings.find((setting) => setting.settingKey === "lrg:usdRate")?.settingValue,
    ) || 0);

  const getImportedSalePrice = (product: Product, conversionRate = effectiveUsdRate) => {
    const toArs = (amount: number, currency: CurrencyCode) =>
      currency === "USD" ? (conversionRate > 0 ? amount * conversionRate : 0) : amount;
    return (
      toArs(product.comision ?? 0, product.comisionCurrency ?? "ARS") +
      toArs(product.gastos ?? 0, product.gastosCurrency ?? "ARS")
    );
  };

  const prepareImportedProductForSave = (product: Product): Product => ({
    ...product,
    price: getImportedSalePrice(product, effectiveUsdRate),
    priceCurrency: "ARS",
    usdRate: effectiveUsdRate || product.usdRate,
  });

  const updateImportedProduct = (productId: string, updates: Partial<Product>) => {
    setPendingImportedProducts((current) =>
      current.map((product) => (product.id === productId ? { ...product, ...updates } : product)),
    );
  };

  const composeImportedImages = async (images: string[], headerImage = importHeaderImage) => {
    if (!headerImage) return images;
    let skippedCount = 0;
    const composed = await Promise.all(
      images.map(async (image) => {
        try {
          return await composeHeaderAboveImageDataUrl(headerImage, image);
        } catch (error) {
          try {
            const hostname = new URL(image).hostname;
            const isPlayStationImage =
              hostname === "playstation.com" ||
              hostname.endsWith(".playstation.com") ||
              hostname === "playstation.net" ||
              hostname.endsWith(".playstation.net");
            if (isPlayStationImage) {
              const localImage = await loadPlayStationProductImageDataUrl({ data: { url: image } });
              return await composeHeaderAboveImageDataUrl(headerImage, localImage);
            }
          } catch {
            // Si el recurso remoto tampoco se puede convertir, conservamos la foto original.
          }
          skippedCount += 1;
          console.warn("No se pudo agregar el encabezado a una imagen importada:", error);
          return image;
        }
      }),
    );
    if (skippedCount) {
      toast.warning(`No se pudo agregar el encabezado a ${skippedCount} imagen(es).`, {
        description:
          "Revisá que las imágenes remotas permitan la composición o cambiá esa imagen por una local.",
      });
    }
    return composed;
  };

  const addHeaderToImportedProduct = async (product: Product, file: File) => {
    try {
      const header = await optimizeImageDataUrl(await fileToDataUrl(file), 1200);
      const originalImage = storeImportPriceDetails[product.id]?.image ?? product.images?.[0];
      if (!originalImage) {
        throw new Error("Este producto no tiene una imagen importada desde el link.");
      }
      const [composedImage] = await composeImportedImages([originalImage], header);
      if (!composedImage || composedImage === originalImage) {
        throw new Error("No se pudo agregar la cabecera a la imagen del producto.");
      }
      updateImportedProduct(product.id, {
        images: [composedImage, ...(product.images ?? []).slice(1)],
      });
      setImportProductHeaders((current) => ({ ...current, [product.id]: header }));
      toast.success("Cabecera agregada a la imagen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar la cabecera.");
    }
  };

  const persistImportHeaderImage = async (image: string) => {
    importHeaderSaveVersionRef.current += 1;
    setIsSavingImportHeader(true);
    try {
      const saved = await saveAdminAsset({
        data: {
          assetKey: PRODUCT_IMPORT_HEADER_ASSET_KEY,
          dataUrl: image,
        },
      });
      if (!saved) throw new Error("No se pudo guardar la cabecera en la base de datos.");
      importHeaderImageRef.current = image;
      setImportHeaderImage(image);
      toast.success(image ? "Cabecera guardada para futuras importaciones" : "Cabecera eliminada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la cabecera.");
    } finally {
      setIsSavingImportHeader(false);
    }
  };

  const applyImportedProductFieldsToAll = async (productId: string) => {
    const source = pendingImportedProducts.find((product) => product.id === productId);
    if (!source || pendingImportedProducts.length < 2 || applyingImportFieldsFromProductId) return;

    setApplyingImportFieldsFromProductId(productId);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    const nextProducts = pendingImportedProducts.map((product) => {
      if (product.id === productId) return product;

      if (importSource === "store") {
        return {
          ...product,
          comision: source.comision,
          comisionCurrency: source.comisionCurrency,
          supplier: source.supplier ? { ...source.supplier } : undefined,
          stock: source.stock,
          stockUnlimited: source.stockUnlimited,
          deliveryUnit: source.deliveryUnit,
          deliveryAmount: source.deliveryAmount,
          short: source.short,
          description: source.description,
          ...(importProductHeaders[source.id]
            ? { image: source.image, images: [...(source.images ?? [])] }
            : {}),
          price: getImportedSalePrice(
            {
              ...product,
              comision: source.comision,
              comisionCurrency: source.comisionCurrency,
            },
            effectiveUsdRate,
          ),
          priceCurrency: "ARS" as const,
          usdRate: effectiveUsdRate || product.usdRate,
        };
      }

      const productWithCopiedCosts = {
        ...source,
        comision: product.comision,
        comisionCurrency: product.comisionCurrency,
      };

      return {
        ...source,
        id: product.id,
        slug: product.slug,
        name: product.name,
        image: product.image,
        images: product.images,
        createdAt: product.createdAt,
        comision: product.comision,
        comisionCurrency: product.comisionCurrency,
        supplier: source.supplier ? { ...source.supplier } : undefined,
        price: getImportedSalePrice(productWithCopiedCosts, effectiveUsdRate),
        priceCurrency: "ARS" as const,
        usdRate: effectiveUsdRate || source.usdRate,
      };
    });
    setPendingImportedProducts(nextProducts);
    if (importSource === "store" && importProductHeaders[source.id]) {
      const sourceHeader = importProductHeaders[source.id];
      setImportProductHeaders((current) =>
        Object.fromEntries(nextProducts.map((product) => [product.id, sourceHeader])),
      );
    }
    setLastAppliedImportSignature(getPendingImportSignature(nextProducts));

    setApplyingImportFieldsFromProductId(null);
    toast.success("Datos aplicados a los demás productos");
  };

  const removeImportedProduct = (productId: string) => {
    setPendingImportedProducts((current) => current.filter((product) => product.id !== productId));
    setStoreImportPriceDetails((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    setImportPreviewPage(0);
  };

  const changeGlobalImportFields = (
    nextBrand: BrandSlug,
    nextCategory: string,
    nextSubcategoryPath: string[],
  ) => {
    const nextImportCode = nextBrand === importBrand ? importCode.trim() || undefined : undefined;
    const previousLabel = getSubcategoryPathLabel(
      importBrand,
      importCategory,
      importSubcategoryPath,
    );
    const nextLabel = getSubcategoryPathLabel(nextBrand, nextCategory, nextSubcategoryPath);
    setPendingImportedProducts((current) =>
      current.map((product) => ({
        ...product,
        code: nextImportCode,
        brand: nextBrand,
        category: nextCategory,
        subcategory: nextSubcategoryPath[0] || undefined,
        subcategoryPath: nextSubcategoryPath.length ? [...nextSubcategoryPath] : undefined,
        name: replaceSubcategorySuffix(product.name, previousLabel, nextLabel),
      })),
    );
    setApplyImportFieldsToAll(true);
    setImportBrand(nextBrand);
    if (nextBrand !== importBrand) setImportCode("");
    setImportCategory(nextCategory);
    setImportSubcategoryPath(nextSubcategoryPath);
    setImportSubcategory(nextSubcategoryPath[0] ?? "");
  };

  const getSubcategoryPathLabel = (brand: BrandSlug, categorySlug: string, path: string[]) => {
    let nodes = brands[brand].categories.find(
      (category) => category.slug === categorySlug,
    )?.subcategories;
    const labels: string[] = [];
    for (const slug of path) {
      const node = nodes?.find((subcategory) => subcategory.slug === slug);
      if (!node) break;
      labels.push(node.name);
      nodes = node.children;
    }
    return labels.join(" - ");
  };

  const handleImportFromStore = async () => {
    if (!storeImportLink.trim()) {
      toast.error("Ingresá el link para continuar.");
      return;
    }
    const pageNumber = Number(storeImportPageNumber);
    const pageEndNumber = Number(storeImportPageEndNumber);
    if (
      (storeImportPageMode === "single" || storeImportPageMode === "range") &&
      (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > 1250)
    ) {
      toast.error("Ingresá un número de página entre 1 y 1250.");
      return;
    }
    if (
      storeImportPageMode === "range" &&
      (!Number.isInteger(pageEndNumber) || pageEndNumber < pageNumber || pageEndNumber > 1250)
    ) {
      toast.error("La página final debe ser igual o mayor a la inicial, hasta 1250.");
      return;
    }

    const append = appendImportedProductsRef.current;
    appendImportedProductsRef.current = false;
    setCreateChoiceOpen(false);
    setImportSetupOpen(false);
    setImportSource("store");
    if (!append) {
      setPendingImportedProducts([]);
      setStoreImportPriceDetails({});
      setImportPreviewPage(0);
      setApplyImportFieldsToAll(true);
    }
    setIsImportingStore(true);
    setImportCategoryOpen(true);
    const headerImageForImport = importHeaderImageRef.current;

    try {
      const result = await importPlayStationStoreCategory({
        data: {
          url: storeImportLink.trim(),
          pageSelection:
            storeImportPageMode === "range"
              ? { mode: "range", from: pageNumber, to: pageEndNumber }
              : storeImportPageMode === "single"
                ? { mode: "single", page: pageNumber }
                : { mode: "all" },
        },
      });
      const subcategoryName = getSubcategoryPathLabel(
        importBrand,
        importCategory,
        importSubcategoryPath,
      );
      const timestamp = Date.now();
      const drafts = await Promise.all(result.products.map(async (item, index) => {
        const name = replaceSubcategorySuffix(item.name, "", subcategoryName);
        const productImage = item.image
          ? await composeImportedImages([item.image], headerImageForImport).then((images) => images[0])
          : undefined;
        const slugBase =
          normalizeProductName(name).replace(/\s+/g, "-") || `store-product-${index}`;
        return {
          id: `psstore-${timestamp}-${index}-${item.id.replace(/[^a-zA-Z0-9-]/g, "-")}`,
          slug: `${slugBase}-${timestamp}-${index}`,
          brand: importBrand,
          code: importCode.trim() || undefined,
          variantName: importAsVariant ? importVariantName.trim() : undefined,
          name,
          category: importCategory,
          subcategory: importSubcategoryPath[0] || undefined,
          subcategoryPath: importSubcategoryPath.length ? importSubcategoryPath : undefined,
          price: 0,
          priceCurrency: "ARS",
          comision: 5000,
          comisionCurrency: "ARS",
          gastos: item.lowestPrice,
          gastosCurrency: "USD",
          stock: 1,
          stockUnlimited: true,
          deliveryUnit: "inmediata",
          deliveryAmount: 0,
          rating: 0,
          reviews: 0,
          short: "",
          description: "",
          features: [],
          images: productImage ? [productImage] : [],
          createdAt: new Date().toISOString(),
        } satisfies Product;
      }));

      const newPriceDetails = Object.fromEntries(
          result.products.map((item, index) => [
            drafts[index]?.id,
            {
              regular: item.basePrice,
              offer: item.discountedPrice,
              discount: item.discountText,
              platforms: item.platforms,
              image: item.image,
            },
          ]),
        );
      setStoreImportPriceDetails((current) =>
        append ? { ...current, ...newPriceDetails } : newPriceDetails,
      );
      setPendingImportedProducts((current) => (append ? [...current, ...drafts] : drafts));
      setImportPreviewPage(append ? Math.floor(pendingImportedProducts.length / 30) : 0);
      toast.success(`${drafts.length} productos encontrados`, {
        description:
          storeImportPageMode !== "all"
            ? `Página${storeImportPageMode === "range" ? "es" : ""} ${pageNumber}${storeImportPageMode === "range" ? ` a ${pageEndNumber}` : ""} de ${result.totalPages} (${result.totalCount} resultados en Store).`
            : `Se revisaron todas las páginas (${result.totalCount} resultados en Store).`,
      });
    } catch (error) {
      console.error("PlayStation Store import failed", error);
      const message =
        error instanceof Error ? error.message : "No se pudieron importar los productos.";
      toast.error(message);
      setImportCategoryOpen(false);
      setImportSource(null);
    } finally {
      setIsImportingStore(false);
    }
  };

  const getDuplicateMatches = (product: Product) => {
    const importedName = product.name.trim();
    if (!importedName) return [];
    return products.filter((existing) => existing.name.trim() === importedName);
  };

  const getVariantMatches = (product: Product) => getDuplicateMatches(product);

  useEffect(() => {
    if (!importAsVariant || !importVariantName.trim() || duplicateCandidateIds.length === 0) return;
    setImportedVariantChoices((current) => {
      let hasChanges = false;
      const next = { ...current };
      const nextVariantName = importVariantName.trim();
      for (const productId of duplicateCandidateIds) {
        const choice = next[productId];
        if (!choice) continue;
        if (choice.variantName !== nextVariantName) {
          next[productId] = { ...choice, variantName: nextVariantName };
          hasChanges = true;
        }
      }
      return hasChanges ? next : current;
    });
  }, [duplicateCandidateIds, importAsVariant, importVariantName]);

  const commitImportedProducts = async (importedProducts: Product[]) => {
    if (!importedProducts.length) {
      toast.info("No seleccionaste productos para agregar.");
      setDuplicateReviewOpen(false);
      setImportCategoryOpen(false);
      setPendingImportedProducts([]);
      return;
    }

    setIsSavingImports(true);
    try {
      const preparedProducts =
        importSource === "text"
          ? importedProducts
          : importedProducts.map(prepareImportedProductForSave);
      const productsToSave = buildImportedProductsWithVariants(
        productsData as Product[],
        preparedProducts,
        importedVariantChoices,
        importAsVariant ? importVariantName : "",
      );
      const saved = await saveProductBatch(productsToSave);
      if (!saved) throw new Error("La base de datos no aceptó los productos importados.");

      const nextProductsById = new Map(
        (productsData as Product[]).map((product) => [product.id, product]),
      );
      productsToSave.forEach((product) => nextProductsById.set(product.id, product));
      const nextProducts = Array.from(nextProductsById.values());
      productsData.splice(0, productsData.length, ...nextProducts);
      setEditableProducts(nextProducts);
      queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
      void queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
      setDuplicateReviewOpen(false);
      setImportCategoryOpen(false);
      setPendingImportedProducts([]);
      setStoreImportPriceDetails({});
      setDuplicateCandidateIds([]);
      setKeepDuplicateIds([]);
      setImportedVariantChoices({});
      toast.success(`Se procesaron ${importedProducts.length} productos y variantes`);
    } catch (error) {
      console.error("Error guardando productos importados:", error);
      toast.error(error instanceof Error ? error.message : "No se pudieron guardar los productos.");
    } finally {
      setIsSavingImports(false);
    }
  };

  const handleConfirmMultipleImport = () => {
    if (!pendingImportedProducts.length) return;
    if (importAsVariant && !importVariantName.trim()) {
      toast.error("Ingresá el nombre de la variante antes de continuar.");
      return;
    }

    const requiresUsdRate = pendingImportedProducts.some(
      (product) =>
        ((product.comisionCurrency ?? "ARS") === "USD" && (product.comision ?? 0) > 0) ||
        ((product.gastosCurrency ?? "ARS") === "USD" && (product.gastos ?? 0) > 0),
    );
    if (requiresUsdRate && effectiveUsdRate <= 0) {
      toast.error("Configurá el tipo de cambio del dólar antes de confirmar los productos.");
      setUsdRatePromptOpen(true);
      return;
    }

    const importedProducts = pendingImportedProducts.reduce<Product[]>((result, product) => {
      const rawName = product.name.trim();
      const price = getImportedSalePrice(product, effectiveUsdRate);
      if (!rawName || !Number.isFinite(price) || price < 0) return result;

      const appliesGlobalFields = applyImportFieldsToAll;
      const brand = appliesGlobalFields ? importBrand : product.brand;
      const category = appliesGlobalFields ? importCategory : product.category;
      const code = appliesGlobalFields ? importCode.trim() || undefined : product.code;
      const subcategoryPath = appliesGlobalFields
        ? importSubcategoryPath
        : (product.subcategoryPath ?? (product.subcategory ? [product.subcategory] : []));
      const subcategory = subcategoryPath[0] || undefined;
      const previousSubcategoryName = getSubcategoryPathLabel(
        product.brand,
        product.category,
        product.subcategoryPath ?? (product.subcategory ? [product.subcategory] : []),
      );
      const nextSubcategoryName = getSubcategoryPathLabel(brand, category, subcategoryPath);
      const name =
        importSource === "store"
          ? replaceSubcategorySuffix(rawName, previousSubcategoryName, nextSubcategoryName).trim()
          : rawName;

      const slugBase =
        name
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || `producto-${Date.now()}`;
      result.push({
        ...product,
        name,
        variantName: importAsVariant ? importVariantName.trim() : product.variantName,
        slug: `${slugBase}-${product.id.replace(/[^a-zA-Z0-9-]/g, "-")}`,
        price,
        priceCurrency: "ARS",
        usdRate: effectiveUsdRate || product.usdRate,
        deliveryUnit: product.deliveryUnit ?? "inmediata",
        brand,
        code,
        category,
        subcategory,
        subcategoryPath: subcategoryPath.length ? subcategoryPath : undefined,
      } as Product);
      return result;
    }, []);

    if (importedProducts.length !== pendingImportedProducts.length) {
      toast.error("Revisá que todos los productos tengan nombre y un precio válido.");
      return;
    }

    setPendingImportedProducts(importedProducts);
    const duplicateIds = importedProducts
      .filter((product) => getDuplicateMatches(product).length > 0)
      .map((product) => product.id);
    setImportedVariantChoices({});
    if (duplicateIds.length > 0) {
      setImportPreviewPage(0);
      setDuplicateCandidateIds(duplicateIds);
      setKeepDuplicateIds([]);
      setDuplicateReviewOpen(true);
      setImportCategoryOpen(false);
      return;
    }

    void commitImportedProducts(importedProducts);
  };

  const handleResolveDuplicates = () => {
    for (const product of pendingImportedProducts) {
      if (!duplicateCandidateIds.includes(product.id)) continue;
      const choice = importedVariantChoices[product.id];
      if (!choice) continue;
      const target = products.find((candidate) => candidate.id === choice.targetProductId);
      const conflictingVariant = target?.variants?.find(
        (variant) =>
          normalizeImportedVariantName(variant.name) ===
          normalizeImportedVariantName(choice.variantName),
      );
      if (conflictingVariant && !choice.existingVariantAction) {
        toast.error(`Elegí si querés reemplazar «${conflictingVariant.name}» o conservarla.`);
        return;
      }
    }

    const duplicateIdSet = new Set(duplicateCandidateIds);
    const keepIdSet = new Set(keepDuplicateIds);
    const acceptedProducts = pendingImportedProducts.filter(
      (product) => {
        if (!duplicateIdSet.has(product.id) || keepIdSet.has(product.id)) return true;
        const choice = importedVariantChoices[product.id];
        return Boolean(choice && choice.existingVariantAction !== "skip");
      },
    );
    void commitImportedProducts(acceptedProducts);
  };

  const handleIncorporateAllDuplicates = () => {
    const variantName = importVariantName.trim();
    if (!variantName) {
      toast.error("Ingresá un nombre de variante en la configuración de importación.");
      return;
    }

    const nextChoices = { ...importedVariantChoices };
    for (const product of pendingImportedProducts) {
      if (!duplicateCandidateIds.includes(product.id)) continue;
      const matches = getVariantMatches(product);
      const currentChoice = nextChoices[product.id];
      const targetProductId = matches.some((match) => match.id === currentChoice?.targetProductId)
        ? currentChoice?.targetProductId
        : matches[0]?.id;
      if (!targetProductId) continue;
      nextChoices[product.id] = {
        ...currentChoice,
        targetProductId,
        variantName: product.variantName?.trim() || variantName,
        existingVariantAction: undefined,
      };
    }
    setImportedVariantChoices(nextChoices);
    setKeepDuplicateIds((current) =>
      current.filter((productId) => !duplicateCandidateIds.includes(productId)),
    );
  };

  const openEditProductDialog = useCallback(
    (product: Product, variant?: ProductVariant) => {
      setEditingProduct(product);
      setInitialVariantId(variant?.id ?? null);
      setProductForm({
        id: product.id,
        name: product.name,
        code: product.code ?? "",
        brand: product.brand,
        category: product.category,
        subcategory: product.subcategory ?? "",
        subcategoryPath:
          product.subcategoryPath ?? (product.subcategory ? [product.subcategory] : []),
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
        deliveryUnit: product.deliveryUnit ?? "inmediata",
        deliveryAmount: product.deliveryAmount ?? 0,
        discount: discounts[product.id] ?? 0,
        variants: product.variants ?? [],
        supplier: product.supplier ?? { name: "", phone: "", social: "", purchaseDate: "" },
      });
      setPendingDiscounts((current) => ({
        ...current,
        [product.id]: String(discounts[product.id] ?? 0),
      }));
      setEditDialogOpen(true);
    },
    [discounts, usdRate],
  );

  const clearProductDeepLink = () => {
    openedDeepLinkRef.current = null;
    if (!routeSearch.productId && !routeSearch.variantId) return;
    void navigate({
      search: (previous) => ({ ...previous, productId: undefined, variantId: undefined }),
      replace: true,
    });
  };

  const restoreProductListPosition = (targetPage: number, scrollTop: number) => {
    setPage(targetPage);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
      });
    });
  };

  const handleDeleteProduct = async (productId: string, variantId?: string) => {
    const pageBeforeDelete = page;
    const scrollTopBeforeDelete = window.scrollY;
    const product = (productsData as Product[]).find((item) => item.id === productId);
    if (!product) {
      toast.error("No se encontró el producto para eliminar.");
      return false;
    }

    try {
      if (variantId) {
        const remainingVariants = (product.variants ?? []).filter(
          (variant) => variant.id !== variantId,
        );
        if (remainingVariants.length === (product.variants ?? []).length) {
          toast.error("No se encontró la variante para eliminar.");
          return false;
        }

        if (remainingVariants.length > 0) {
          const updatedProduct = { ...product, variants: remainingVariants };
          const saved = await saveProduct(updatedProduct);
          if (!saved) throw new Error("La base de datos no aceptó el cambio.");
          const nextProducts = (productsData as Product[]).map((item) =>
            item.id === productId ? updatedProduct : item,
          );
          productsData.splice(0, productsData.length, ...nextProducts);
          setEditableProducts(nextProducts);
          queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
          void queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
          toast.success("Variante eliminada");
          restoreProductListPosition(pageBeforeDelete, scrollTopBeforeDelete);
          return true;
        }
      }

      const deleted = await deleteAdminProduct({ data: { id: product.id } });
      if (!deleted) throw new Error("La base de datos no aceptó la eliminación.");

      moveToTrash({ type: "producto", id: product.id, item: product });
      const nextProducts = (productsData as Product[]).filter((item) => item.id !== productId);
      productsData.splice(0, productsData.length, ...nextProducts);
      setEditableProducts(nextProducts);
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
      queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
      void queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
      toast.success("Producto eliminado y enviado a la papelera");
      restoreProductListPosition(pageBeforeDelete, scrollTopBeforeDelete);
      return true;
    } catch (error) {
      console.error("Error eliminando producto:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el producto.");
      return false;
    }
  };

  const handleDuplicateProduct = async (product: Product) => {
    const timestamp = Date.now();
    const uniqueSuffix = `${timestamp}-${Math.random().toString(36).slice(2, 7)}`;
    const newId = `${product.id}-copy-${uniqueSuffix}`;
    const newSlug = `${product.slug}-copy-${uniqueSuffix}`
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/--+/g, "-");
    const duplicated: Product = {
      ...product,
      parentId: undefined,
      variantId: undefined,
      id: newId,
      slug: newSlug,
      name: `${product.name} (Copia)`,
      createdAt: new Date().toISOString(),
    };

    // Add to in-memory dataset so public getters reflect it and update UI
    (productsData as Product[]).push(duplicated);
    setEditableProducts((current) => [...current, duplicated]);
    await saveProducts(productsData as Product[]);
    queryClient.setQueryData(catalogQueries.allAdmin().queryKey, [...productsData]);
    void queryClient.invalidateQueries({
      queryKey: ["products"],
      refetchType: "active",
    });
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
    void saveProducts(nextProducts)
      .then(() => {
        queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
        return queryClient.invalidateQueries({ queryKey: ["products"] });
      })
      .catch((error) => {
        console.error("Error actualizando la visibilidad del producto:", error);
        toast.error("No se pudo actualizar la visibilidad del producto.");
      });
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
    hasScrolledOnProductSelectionRef.current = false;
    setBulkEditQueue([]);
    setBulkQuickEditQueue([]);
    setBulkEditPosition(0);
    setIsBulkEditSession(false);
    bulkEditQueueRef.current = [];
    bulkEditPositionRef.current = 0;
  };

  const getBulkProductQueue = () => Array.from(new Set(selectedProductIds));

  const resolveBulkEditSelection = (selectionKey: string) => {
    const [productId, ...variantParts] = selectionKey.split(":");
    const variantId = variantParts.length ? variantParts.join(":") : undefined;
    const product =
      (productsData as Product[]).find((item) => item.id === productId) ??
      editableProducts.find((item) => item.id === productId);
    if (!product) return null;
    const variant =
      variantId && variantId !== "base"
        ? product.variants?.find((item) => item.id === variantId)
        : undefined;
    return { product, variant };
  };

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
    scrollToTopOnFirstSelection(
      selectedProductIds.length,
      checked,
      hasScrolledOnProductSelectionRef,
    );
    setSelectedProductIds((current) => {
      const next = checked
        ? current.includes(selectionKey)
          ? current
          : [...current, selectionKey]
        : current.filter((key) => key !== selectionKey);

      if (next.length === 0) hasScrolledOnProductSelectionRef.current = false;
      setSelectionMode(next.length > 0);
      return next;
    });
  };

  const handleBulkDeleteProducts = async () => {
    const pageBeforeDelete = page;
    const scrollTopBeforeDelete = window.scrollY;
    const selectedEntriesSnapshot = getSelectedProductEntries(selectedProductIds);
    const selectedEntries = selectedEntriesSnapshot;
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

    const deletedProducts: Product[] = [];
    const updatedProducts: Product[] = [];
    const nextProducts = (productsData as Product[])
      .map((product) => {
        const selectedVariantIds = selectedVariantIdsByProduct.get(product.id) ?? [];
        const hasWholeProductSelection = selectedProductIdsSet.has(product.id);

        if (hasWholeProductSelection) {
          deletedProducts.push(product);
          return null;
        }

        if (selectedVariantIds.length > 0) {
          const remainingVariants = (product.variants ?? []).filter(
            (variant) => !selectedVariantIds.includes(variant.id),
          );

          if (remainingVariants.length === 0 && !hasWholeProductSelection) {
            deletedProducts.push(product);
            return null;
          }

          const updatedProduct = {
            ...product,
            variants: remainingVariants,
          };
          updatedProducts.push(updatedProduct);
          return updatedProduct;
        }

        return product;
      })
      .filter((product): product is Product => Boolean(product));

    if (!selectedEntries.length) {
      clearBulkProductSelection();
      return;
    }

    try {
      for (const product of deletedProducts) {
        const deleted = await deleteAdminProduct({ data: { id: product.id } });
        if (!deleted) throw new Error(`No se pudo eliminar «${product.name}».`);
      }
      for (const product of updatedProducts) {
        const saved = await saveProduct(product);
        if (!saved) throw new Error(`No se pudo actualizar «${product.name}».`);
      }

      deletedProducts.forEach((product) =>
        moveToTrash({ type: "producto", id: product.id, item: product }),
      );
      productsData.splice(0, productsData.length, ...nextProducts);
      setEditableProducts(nextProducts);
      queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
      void queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
      clearBulkProductSelection();
      restoreProductListPosition(pageBeforeDelete, scrollTopBeforeDelete);
      toast.success(
        `${selectedEntries.length} elemento${selectedEntries.length === 1 ? "" : "s"} eliminado${selectedEntries.length === 1 ? "" : "s"}`,
      );
    } catch (error) {
      console.error("Error eliminando productos seleccionados:", error);
      clearBulkProductSelection();
      toast.error(error instanceof Error ? error.message : "No se pudieron eliminar los productos.");
    }
  };

  const handleBulkToggleProducts = async (hidden: boolean) => {
    const selectedEntries = getSelectedProductEntries(selectedProductIds);
    clearBulkProductSelection();
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
  };

  const handleBulkDuplicateProducts = async () => {
    const selectedEntries = getSelectedProductEntries(selectedProductIds);
    clearBulkProductSelection();
    if (!selectedEntries.length) return;

    const duplicates: Product[] = [];
    for (const entry of selectedEntries) {
      const product = (productsData as Product[]).find((item) => item.id === entry.productId);
      if (!product) continue;

      if (!entry.variantId) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 7);
        const newId = `${product.id}-copy-${timestamp}-${random}`;
        const newSlug = `${product.slug}-copy-${timestamp}-${random}`
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/--+/g, "-");

        duplicates.push({
          ...product,
          parentId: undefined,
          variantId: undefined,
          id: newId,
          slug: newSlug,
          name: `${product.name} (Copia)`,
          createdAt: new Date().toISOString(),
          hidden: Boolean(product.hidden),
        });
        continue;
      }

      const selectedVariant = product.variants?.find((variant) => variant.id === entry.variantId);
      if (!selectedVariant) continue;

      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 7);
      const newId = `${product.id}-copy-${timestamp}-${random}`;
      const newSlug = `${product.slug}-copy-${timestamp}-${random}`
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-");
      const duplicatedVariant = {
        ...selectedVariant,
        id: `${selectedVariant.id}-copy-${timestamp}-${random}`,
        hidden: Boolean(selectedVariant.hidden),
      };

      duplicates.push({
        ...product,
        parentId: undefined,
        variantId: undefined,
        id: newId,
        slug: newSlug,
        name: `${product.name} (Copia)`,
        variantName: selectedVariant.name,
        variants: [duplicatedVariant],
        hidden: Boolean(product.hidden),
        createdAt: new Date().toISOString(),
      });
    }

    if (!duplicates.length) return;

    const nextProducts = [...(productsData as Product[]), ...duplicates];
    productsData.splice(0, productsData.length, ...nextProducts);
    setEditableProducts(nextProducts);
    await saveProducts(nextProducts);
    queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
    void queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
    toast.success(
      `${duplicates.length} elemento${duplicates.length === 1 ? "" : "s"} duplicado${duplicates.length === 1 ? "" : "s"}`,
    );
  };

  const clearBulkSelection = () => {
    setSelectionMode(false);
    setSelectedProductIds([]);
    hasScrolledOnProductSelectionRef.current = false;
    setBulkEditQueue([]);
    setBulkEditPosition(0);
    bulkEditQueueRef.current = [];
    bulkEditPositionRef.current = 0;
  };

  const closeProductEditor = () => {
    clearProductDeepLink();
    setProductForm(null);
    setEditingProduct(null);
    setInitialVariantId(null);
    clearBulkProductSelection();
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
  };

  const handleBulkEditProducts = () => {
    const selectedEntriesForBulk = getBulkProductQueue();
    if (!selectedEntriesForBulk.length) return;

    const firstEntry = resolveBulkEditSelection(selectedEntriesForBulk[0]!);
    if (!firstEntry) return;

    bulkEditQueueRef.current = selectedEntriesForBulk;
    bulkEditPositionRef.current = 0;
    setIsBulkEditSession(selectedEntriesForBulk.length > 1);
    setBulkEditQueue(selectedEntriesForBulk);
    setBulkEditPosition(0);

    openEditProductDialog(firstEntry.product, firstEntry.variant);
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

    const nextSelectionKey = queue[nextPosition];
    if (!nextSelectionKey) return;
    const nextEntry = resolveBulkEditSelection(nextSelectionKey);
    if (!nextEntry) return;

    bulkEditQueueRef.current = queue;
    bulkEditPositionRef.current = nextPosition;
    setBulkEditQueue(queue);
    setBulkEditPosition(nextPosition);

    openEditProductDialog(nextEntry.product, nextEntry.variant);
  };

  const skipBulkEditProduct = () => {
    const queue = bulkEditQueueRef.current;
    const currentProductId = productForm?.id;
    if (!currentProductId || !queue.length || !isBulkEditSession) return;

    const currentPosition = bulkEditPositionRef.current;
    const currentSelectionKey = initialVariantId
      ? `${currentProductId}:${initialVariantId}`
      : currentProductId;
    const remainingQueue = removeSelectionFromQueue(queue, currentSelectionKey);
    const nextPosition = Math.min(currentPosition, remainingQueue.length - 1);
    const nextSelectionKey = remainingQueue[nextPosition];
    if (!nextSelectionKey) {
      closeProductEditor();
      return;
    }

    setSelectedProductIds((current) =>
      removeSelectionFromQueue(current, currentSelectionKey),
    );
    bulkEditQueueRef.current = remainingQueue;
    bulkEditPositionRef.current = nextPosition;
    setBulkEditQueue(remainingQueue);
    setBulkEditPosition(nextPosition);

    const nextEntry = resolveBulkEditSelection(nextSelectionKey);
    if (!nextEntry) {
      closeProductEditor();
      return;
    }
    openEditProductDialog(nextEntry.product, nextEntry.variant);
  };

  const moveBulkEditToPrevious = (currentSelectionKey: string, removedKeys: string[]) => {
    const queue = bulkEditQueueRef.current;
    const currentPosition = Math.max(0, queue.indexOf(currentSelectionKey));
    const removed = new Set(removedKeys);
    const remainingQueue = queue.filter((selectionKey) => !removed.has(selectionKey));
    setSelectedProductIds((current) =>
      current.filter((selectionKey) => !removed.has(selectionKey)),
    );

    if (!remainingQueue.length) {
      closeProductEditor();
      return;
    }

    let previousSelectionKey: string | undefined;
    for (let offset = 1; offset <= queue.length; offset += 1) {
      const candidateIndex = (currentPosition - offset + queue.length) % queue.length;
      const candidate = queue[candidateIndex];
      if (candidate && remainingQueue.includes(candidate)) {
        previousSelectionKey = candidate;
        break;
      }
    }
    previousSelectionKey ??= remainingQueue[remainingQueue.length - 1];

    bulkEditQueueRef.current = remainingQueue;
    const nextPosition = remainingQueue.indexOf(previousSelectionKey!);
    bulkEditPositionRef.current = nextPosition;
    setBulkEditQueue(remainingQueue);
    setBulkEditPosition(nextPosition);

    const previousEntry = resolveBulkEditSelection(previousSelectionKey!);
    if (previousEntry) {
      openEditProductDialog(previousEntry.product, previousEntry.variant);
      return;
    }
    closeProductEditor();
  };

  const getQuickEditKey = (product: Product, variant?: ProductVariant) =>
    `${product.id}:${variant?.id ?? "base"}`;

  const normalizeQuickEditSelectionKey = (selectionKey: string) => {
    const [productId, ...variantParts] = selectionKey.split(":");
    return `${productId}:${variantParts.length ? variantParts.join(":") : "base"}`;
  };

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
        comision: String(source.comision ?? 0),
        comisionCurrency: source.comisionCurrency ?? product.comisionCurrency ?? "ARS",
        gastos: source.gastos ?? 0,
        gastosCurrency: source.gastosCurrency ?? product.gastosCurrency ?? "ARS",
        stock: source.stock,
        stockUnlimited: source.stockUnlimited ?? product.stockUnlimited ?? false,
        discount: variant?.discount ?? discounts[product.id] ?? 0,
      },
    }));
  };

  const cancelQuickEdit = () => {
    const currentSelectionKey = quickEditProductId
      ? `${quickEditProductId}:${quickEditVariantId ?? "base"}`
      : null;
    const remainingQueue = currentSelectionKey
      ? removeSelectionFromQueue(
          bulkQuickEditQueue,
          normalizeQuickEditSelectionKey(currentSelectionKey),
        )
      : [...bulkQuickEditQueue];
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

  const saveQuickEdit = async (product: Product, variant?: ProductVariant) => {
    const key = getQuickEditKey(product, variant);
    const draft = quickEditForm[key];
    if (!draft) return;

    const nextBrand = draft.brand;
    const nextName = draft.name.trim() || product.name;
    const nextVariantName = draft.variantName.trim() || variant?.name || "";
    const nextCategory = draft.category.trim() || product.category;
    const nextPrice = Number(draft.price) || product.price;
    const nextComision = parseQuickEditCommission(draft.comision);
    if (nextComision === null) {
      toast.error("Ingresá un valor numérico válido para la comisión.");
      return;
    }
    const nextComisionCurrency = draft.comisionCurrency;
    const nextGastos = Math.max(0, Number(draft.gastos) || 0);
    const nextGastosCurrency = draft.gastosCurrency;
    const nextStock = Math.max(0, Number(draft.stock) || 0);
    const nextDiscount = Math.max(0, Math.min(100, Number(draft.discount) || 0));

    const nextProducts = (productsData as Product[]).map((item) => {
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
                  stockUnlimited: draft.stockUnlimited,
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
        stockUnlimited: draft.stockUnlimited,
      };
    });
    const updatedProduct = nextProducts.find((item) => item.id === product.id);
    if (!updatedProduct) {
      toast.error("No se encontró el producto para guardar.");
      return;
    }

    setIsSavingQuickEdit(true);
    try {
      const saved = await saveProduct(updatedProduct);
      if (!saved) throw new Error("La base de datos no aceptó los cambios.");
      productsData.splice(0, productsData.length, ...nextProducts);
      setEditableProducts(nextProducts);
      queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
      void queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
    } catch (error) {
      setIsSavingQuickEdit(false);
      console.error("Error guardando la edición rápida del producto:", error);
      toast.error(
        error instanceof Error ? error.message : "No se pudieron guardar los cambios del producto.",
      );
      return;
    }
    setIsSavingQuickEdit(false);

    setDiscounts((current) => ({
      ...current,
      [product.id]: nextDiscount,
    }));
    setPendingDiscounts((current) => ({
      ...current,
      [product.id]: String(nextDiscount),
    }));

    const currentSelectionKey = key;
    const remainingQueue = removeSelectionFromQueue(
      bulkQuickEditQueue,
      normalizeQuickEditSelectionKey(currentSelectionKey),
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

    const processedImages = await Promise.all(
      productForm.images.map(async (image, index) => {
        try {
          const resized = await optimizeImageDataUrl(image);
          return await optimizeImageDataUrl(await cropImageDataUrl(resized));
        } catch (error) {
          const reason = error instanceof Error ? error.message : "Error desconocido.";
          throw new Error(`No se pudo preparar la imagen ${index + 1}: ${reason}`);
        }
      }),
    );

    let savedProductId = productForm.id;

    const normalizedBrand: BrandSlug = productForm.brand || "arcade";
    const normalizedDeliveryUnit: DeliveryUnit = productForm.deliveryUnit || "inmediata";

    const updatedProduct = {
      name: productForm.name,
      code: productForm.code.trim() || undefined,
      brand: normalizedBrand,
      category: productForm.category,
      subcategory: productForm.subcategoryPath[0] || productForm.subcategory || undefined,
      subcategoryPath: productForm.subcategoryPath.length
        ? productForm.subcategoryPath
        : productForm.subcategory
          ? [productForm.subcategory]
          : undefined,
      price: productForm.price,
      priceCurrency: productForm.priceCurrency,
      comision: productForm.comision,
      comisionCurrency: productForm.comisionCurrency,
      gastos: productForm.gastos,
      gastosCurrency: productForm.gastosCurrency,
      usdRate: productForm.usdRate,
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
    };

    let nextProducts: Product[];
    let productToSave: Product;
    if (editingProduct) {
      nextProducts = (productsData as Product[]).map((product) =>
        product.id === productForm.id ? { ...product, ...updatedProduct } : product,
      );
      const updated = nextProducts.find((product) => product.id === productForm.id);
      if (!updated) throw new Error("No se encontró el producto que se intentaba actualizar.");
      productToSave = updated;
    } else {
      savedProductId = `new-${Date.now()}`;
      productToSave = {
        ...updatedProduct,
        id: savedProductId,
        slug: productForm.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, ""),
        rating: 0,
        reviews: 0,
        short: productForm.description,
        createdAt: new Date().toISOString(),
      } as Product;
      nextProducts = [...(productsData as Product[]), productToSave];
    }

    const requestSize = new TextEncoder().encode(JSON.stringify(productToSave)).byteLength;
    if (requestSize > 3_500_000) {
      throw new Error(
        "Las imágenes de este producto siguen ocupando demasiado espacio. Reducí la cantidad o el tamaño de las imágenes e intentá de nuevo.",
      );
    }

    const saved = await saveProduct(productToSave);
    if (!saved) {
      throw new Error(
        "Turso no aceptó el guardado. Revisá la conexión y las variables de base de datos.",
      );
    }

    productsData.splice(0, productsData.length, ...nextProducts);
    setEditableProducts(nextProducts);

    if (savedProductId) {
      setDiscounts((current) => ({
        ...current,
        [savedProductId]: productForm.discount,
      }));
    }

    queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
    void queryClient.invalidateQueries({ queryKey: ["products"], refetchType: "active" });
    toast.success("Producto guardado");
    const currentProductId = productForm.id;
    const queueBeforeSave = bulkEditQueueRef.current;
    const isBulkEditing = queueBeforeSave.length > 0;

    if (!isBulkEditing) {
      closeProductEditor();
      return;
    }

    const currentSelectionKey = initialVariantId
      ? `${currentProductId}:${initialVariantId}`
      : currentProductId;
    if (!queueBeforeSave.includes(currentSelectionKey)) {
      closeProductEditor();
      return;
    }
    moveBulkEditToPrevious(currentSelectionKey, [currentSelectionKey]);
  };

  const handleSaveProduct = async () => {
    if (isSavingProduct) return;
    setIsSavingProduct(true);
    try {
      await persistProduct();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el producto.";
      toast.error(message);
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

  const availableSuppliers = useMemo(() => {
    const supplierSetting = adminSettings.find((setting) => setting.settingKey === "lrg:suppliers");
    let registeredNames: string[] = [];
    try {
      const parsed = JSON.parse(supplierSetting?.settingValue ?? "[]") as unknown;
      if (Array.isArray(parsed)) {
        registeredNames = parsed
          .map((supplier) =>
            supplier && typeof supplier === "object" && "name" in supplier
              ? String(supplier.name).trim()
              : "",
          )
          .filter(Boolean);
      }
    } catch {
      registeredNames = [];
    }
    return Array.from(
      new Set([
        ...registeredNames,
        ...editableProducts
          .flatMap((product) => [
            product.supplier?.name,
            ...(product.variants ?? []).map((variant) => variant.supplier?.name),
          ])
          .map((name) => name?.trim())
          .filter((name): name is string => Boolean(name)),
      ]),
    ).sort((first, second) => first.localeCompare(second, "es", { sensitivity: "base" }));
  }, [adminSettings, editableProducts]);

  const availableSkus = useMemo(() => {
    const skuOptions = new Map<
      string,
      { key: string; label: string; brand: BrandSlug; code: string }
    >();
    const skuSetting = adminSettings.find((setting) => setting.settingKey === "lrg:productSkus");
    let storedSkus: Partial<Record<BrandSlug, Array<{ code?: string }>>> = {};
    try {
      const parsed = JSON.parse(skuSetting?.settingValue ?? "{}") as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        storedSkus = parsed as Partial<Record<BrandSlug, Array<{ code?: string }>>>;
      }
    } catch {
      storedSkus = {};
    }
    const addSku = (brand: BrandSlug, codeValue?: string) => {
      const code = codeValue?.trim();
      if (!code) return;
      const key = `${brand}|${code}`;
      const brandName = brandList.find((entry) => entry.slug === brand)?.name ?? brand;
      skuOptions.set(key, { key, label: `${brandName} · ${code}`, brand, code });
    };
    brandList.forEach((brand) => {
      [...(brand.productSkus ?? []), ...(storedSkus[brand.slug] ?? [])].forEach((sku) =>
        addSku(brand.slug, sku.code),
      );
    });
    editableProducts.forEach((product) => addSku(product.brand, product.code));
    return Array.from(skuOptions.values()).sort((first, second) =>
      first.label.localeCompare(second.label, "es", { sensitivity: "base" }),
    );
  }, [adminSettings, editableProducts]);
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
  const formatCategoryLabel = useCallback((slug: string) => {
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
  }, [categoryLabels]);

  const availableCategoryNodes = useMemo(() => {
    const categoryTrees = new Map<
      string,
      { brand: BrandSlug; category: string; nodes: CategoryLabelNode[] }
    >();
    const ensureNode = (nodes: CategoryLabelNode[], slug: string): CategoryLabelNode => {
      let node = nodes.find((entry) => entry.slug === slug);
      if (!node) {
        node = { slug, name: formatCategoryLabel(slug), children: [] };
        nodes.push(node);
      }
      node.children ??= [];
      return node;
    };

    editableProducts.forEach((product) => {
      const category = product.category.trim();
      if (!category) return;
      const treeKey = `${product.brand}|${category}`;
      let tree = categoryTrees.get(treeKey);
      if (!tree) {
        const configuredCategory = brands[product.brand]?.categories.find(
          (entry) => entry.slug === category,
        );
        tree = {
          brand: product.brand,
          category,
          nodes: structuredClone(configuredCategory?.subcategories ?? []),
        };
        categoryTrees.set(treeKey, tree);
      }

      const path = product.subcategoryPath?.length
        ? product.subcategoryPath
        : product.subcategory
          ? [product.subcategory]
          : [];
      let nodes = tree.nodes;
      path.forEach((slug) => {
        const node = ensureNode(nodes, slug);
        nodes = node.children ?? [];
      });
    });

    const buildNodes = (
      nodes: CategoryLabelNode[],
      brand: BrandSlug,
      category: string,
      parentPath: string[],
    ): AdminCategoryFilterNode[] =>
      nodes.map((node) => {
        const path = [...parentPath, node.slug];
        return {
          key: `subcategory:${brand}:${category}:${path.join("/")}`,
          brand,
          category,
          path,
          label: node.name,
          children: buildNodes(node.children ?? [], brand, category, path),
        };
      });

    return Array.from(categoryTrees.values())
      .map(({ brand, category, nodes }) => {
        const categoryName =
          brands[brand]?.categories.find((entry) => entry.slug === category)?.name ??
          formatCategoryLabel(category);
        return {
          key: `category:${brand}:${category}`,
          brand,
          category,
          path: [],
          label: `${categoryName} · ${brandList.find((entry) => entry.slug === brand)?.shortName ?? brand}`,
          children: buildNodes(nodes, brand, category, []),
        } satisfies AdminCategoryFilterNode;
      })
      .sort((first, second) => first.label.localeCompare(second.label, "es"));
  }, [editableProducts, formatCategoryLabel]);
  const categoryFilterNodeMap = useMemo(() => {
    const nodes = new Map<string, AdminCategoryFilterNode>();
    const collect = (items: AdminCategoryFilterNode[]) => {
      items.forEach((node) => {
        nodes.set(node.key, node);
        collect(node.children);
      });
    };
    collect(availableCategoryNodes);
    return nodes;
  }, [availableCategoryNodes]);

  const isCategoryFilterNodeCovered = (
    node: AdminCategoryFilterNode,
    selectedKeys: string[],
  ): boolean => {
    if (selectedKeys.includes(node.key)) return true;
    if (node.path.length === 0) return false;
    const ancestorKeys = [
      `category:${node.brand}:${node.category}`,
      ...node.path.slice(0, -1).map((_, index) =>
        `subcategory:${node.brand}:${node.category}:${node.path.slice(0, index + 1).join("/")}`,
      ),
    ];
    return ancestorKeys.some((key) => selectedKeys.includes(key));
  };

  const normalizeCategoryFilter = (selectedKeys: string[]) => {
    const isFullyCovered = (node: AdminCategoryFilterNode, coveredKeys: string[]): boolean =>
      coveredKeys.includes(node.key) ||
      (node.children.length > 0 &&
        node.children.every((child) => isFullyCovered(child, coveredKeys)));
    const normalizeNode = (node: AdminCategoryFilterNode): string[] => {
      if (selectedKeys.includes(node.key)) return [node.key];
      const normalizedChildren = node.children.flatMap(normalizeNode);
      if (
        node.children.length > 0 &&
        node.children.every((child) => isFullyCovered(child, normalizedChildren))
      ) {
        return [node.key];
      }
      return normalizedChildren;
    };
    return availableCategoryNodes.flatMap(normalizeNode);
  };

  const toggleCategoryFilterNode = (node: AdminCategoryFilterNode, checked: boolean) => {
    setCategoryFilter((current) => {
      const next = new Set(current);
      const isDescendantOf = (candidate: AdminCategoryFilterNode, ancestor: AdminCategoryFilterNode) =>
        candidate.brand === ancestor.brand &&
        candidate.category === ancestor.category &&
        candidate.path.length > ancestor.path.length &&
        ancestor.path.every((slug, index) => candidate.path[index] === slug);

      if (checked) {
        for (const key of current) {
          const selectedNode = categoryFilterNodeMap.get(key);
          if (
            selectedNode &&
            (selectedNode.key === node.key ||
              isDescendantOf(selectedNode, node) ||
              isDescendantOf(node, selectedNode))
          ) {
            next.delete(key);
          }
        }
        next.add(node.key);
      } else {
        const excludeCoveredNode = (
          candidate: AdminCategoryFilterNode,
          inheritedCoverage = false,
        ): void => {
          if (candidate.key === node.key) {
            next.delete(candidate.key);
            return;
          }
          if (
            (inheritedCoverage || next.has(candidate.key)) &&
            isDescendantOf(node, candidate)
          ) {
            next.delete(candidate.key);
            candidate.children.forEach((child) => {
              if (child.key === node.key || isDescendantOf(node, child)) {
                excludeCoveredNode(child, true);
              } else {
                next.add(child.key);
              }
            });
            return;
          }
          candidate.children.forEach((child) => {
            if (child.key === node.key || isDescendantOf(node, child)) {
              excludeCoveredNode(child, inheritedCoverage);
            }
          });
        };

        for (const candidate of availableCategoryNodes) {
          excludeCoveredNode(candidate);
        }
        for (const key of Array.from(next)) {
          const selectedNode = categoryFilterNodeMap.get(key);
          if (selectedNode && isDescendantOf(selectedNode, node)) next.delete(key);
        }
      }

      return normalizeCategoryFilter(Array.from(next));
    });
  };

  const results = useMemo(() => {
    const filtered = editableProducts.filter((product) => {
      if (brandFilter.length && !brandFilter.includes(product.brand)) return false;
      if (supplierFilter.length) {
        const assignedSuppliers = [
          product.supplier?.name,
          ...(product.variants ?? []).map((variant) => variant.supplier?.name),
        ].filter((name): name is string => Boolean(name?.trim()));
        const onlyUnassigned = supplierFilter.includes(UNASSIGNED_SUPPLIER_FILTER);
        if (
          onlyUnassigned
            ? assignedSuppliers.length > 0
            : !assignedSuppliers.some((name) => supplierFilter.includes(name.trim()))
        )
          return false;
      }
      if (skuFilter.length) {
        const onlyWithoutSku = skuFilter.includes(UNASSIGNED_SKU_FILTER);
        const productSkuKey = product.code?.trim() ? `${product.brand}|${product.code.trim()}` : "";
        if (onlyWithoutSku ? Boolean(productSkuKey) : !skuFilter.includes(productSkuKey))
          return false;
      }
      if (
        categoryFilter.length &&
        !categoryFilter.some((key) => {
          const selectedNode = categoryFilterNodeMap.get(key);
          if (
            !selectedNode ||
            selectedNode.brand !== product.brand ||
            selectedNode.category !== product.category
          )
            return false;
          if (!selectedNode.path.length) return true;
          const productPath = product.subcategoryPath?.length
            ? product.subcategoryPath
            : product.subcategory
              ? [product.subcategory]
              : [];
          return selectedNode.path.every((slug, index) => productPath[index] === slug);
        })
      )
        return false;
      if (currencyFilter.length && !currencyFilter.includes(product.priceCurrency ?? "ARS"))
        return false;
      if (discountOnly && (discounts[product.id] ?? 0) <= 0) return false;
      if (stockOnly && product.stock <= 0) return false;
      const storePrice = product.price * (1 - (discounts[product.id] ?? 0) / 100);
      const selectedPrice = priceMode === "storePrice" ? storePrice : product.price;
      if (selectedPrice < priceMin || selectedPrice > priceMax) return false;

      return true;
    });
    const searchedProducts = filterAdminProductsBySearch(filtered, query);

    return [...searchedProducts].sort((a, b) => {
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
    supplierFilter,
    skuFilter,
    categoryFilter,
    categoryFilterNodeMap,
    currencyFilter,
    priceMode,
    priceMin,
    priceMax,
    discountOnly,
    stockOnly,
    availableOnly,
    hiddenOnly,
    sortOrder,
    discounts,
  ]);

  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  type DisplayRow = { product: Product; variant: ProductVariant | undefined };

  const allDisplayRows = useMemo<DisplayRow[]>(() => {
    return results.flatMap((product): DisplayRow[] => {
      if (product.variants && product.variants.length > 0) {
        return product.variants.map((variant) => ({ product, variant }));
      }
      return [{ product, variant: undefined }];
    }).filter((row) => {
      const isHidden = isProductRowHidden(row.product, row.variant);
      if (availableOnly && isHidden) return false;
      if (hiddenOnly && !isHidden) return false;
      return true;
    });
  }, [results, availableOnly, hiddenOnly]);
  useEffect(() => {
    if (!routeSearch.productId || !pageSize) return;
    const rowIndex = allDisplayRows.findIndex(
      ({ product, variant }) =>
        product.id === routeSearch.productId &&
        (variant?.id ?? undefined) === routeSearch.variantId,
    );
    if (rowIndex < 0) return;
    const targetPage = Math.floor(rowIndex / pageSize);
    if (page !== targetPage) setPage(targetPage);
  }, [allDisplayRows, page, pageSize, routeSearch.productId, routeSearch.variantId]);
  const displayRows = useMemo(() => {
    if (!pageSize || pageSize <= 0) return [];
    return allDisplayRows.slice(page * pageSize, page * pageSize + pageSize);
  }, [allDisplayRows, page, pageSize]);

  useEffect(() => {
    const productId = routeSearch.productId;
    if (!productId) {
      highlightedDeepLinkRef.current = null;
      return;
    }
    if (!displayRows.length) return;
    const deepLinkKey = `${productId}:${routeSearch.variantId ?? ""}`;
    if (openedDeepLinkRef.current === deepLinkKey) return;

    const targetRow = displayRows.find(
      ({ product, variant }) =>
        product.id === productId && (variant?.id ?? undefined) === routeSearch.variantId,
    );
    if (!targetRow) return;

    const rowKey = `${productId}-${routeSearch.variantId ?? "base"}`;
    let highlightTimeout: number | undefined;
    let openDialogFrame: number | undefined;
    const isAlreadyHighlighted = highlightedDeepLinkRef.current === deepLinkKey;
    const frame = window.requestAnimationFrame(() => {
      const rowElement = document.getElementById(`product-${rowKey}`);
      if (!rowElement) return;

      if (!isAlreadyHighlighted) {
        highlightedDeepLinkRef.current = deepLinkKey;
        rowElement.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedDeepLinkKey(rowKey);
      }
      highlightTimeout = window.setTimeout(() => {
        setHighlightedDeepLinkKey((current) => (current === rowKey ? null : current));
        openDialogFrame = window.requestAnimationFrame(() => {
          openedDeepLinkRef.current = deepLinkKey;
          openEditProductDialog(targetRow.product, targetRow.variant);
        });
      }, 3000);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (highlightTimeout !== undefined) window.clearTimeout(highlightTimeout);
      if (openDialogFrame !== undefined) window.cancelAnimationFrame(openDialogFrame);
    };
  }, [displayRows, openEditProductDialog, routeSearch.productId, routeSearch.variantId]);

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
    pageSize && pageSize > 0 ? Math.max(1, Math.ceil(allDisplayRows.length / pageSize)) : 1;
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);
  const hasNextPage = page + 1 < totalPages;
  const hasPreviousPage = page > 0;
  const goToProductPage = (nextPage: number) => {
    setPage(nextPage);
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" }));
  };
  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    categoryFilter.length +
    brandFilter.length +
    supplierFilter.length +
    skuFilter.length +
    (currencyFilter.length === 1 ? 1 : 0) +
    (priceMode !== "storePrice" ? 1 : 0) +
    (priceMin > 0 ? 1 : 0) +
    (priceMax < priceLimit ? 1 : 0) +
    (discountOnly ? 1 : 0) +
    (stockOnly ? 1 : 0) +
    (availableOnly ? 1 : 0) +
    (hiddenOnly ? 1 : 0);

  const resetFilters = () => {
    setCategoryFilter([]);
    setBrandFilter([]);
    setSupplierFilter([]);
    setSkuFilter([]);
    setCurrencyFilter(["ARS", "USD"]);
    setPriceMode("storePrice");
    setPriceMin(0);
    setPriceMax(priceLimit);
    setDiscountOnly(false);
    setStockOnly(false);
    setAvailableOnly(false);
    setHiddenOnly(false);
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
      label: categoryFilterNodeMap.get(value)?.label ?? value,
      onRemove: () => setCategoryFilter((current) => current.filter((item) => item !== value)),
    })),
    ...brandFilter.map((value) => ({
      key: `brand-${value}`,
      label: brandList.find((brand) => brand.slug === value)?.name ?? value,
      onRemove: () => setBrandFilter((current) => current.filter((item) => item !== value)),
    })),
    ...supplierFilter.map((value) => ({
      key: `supplier-${value}`,
      label: value === UNASSIGNED_SUPPLIER_FILTER ? "Ninguno" : value,
      onRemove: () => setSupplierFilter((current) => current.filter((item) => item !== value)),
    })),
    ...skuFilter.map((value) => ({
      key: `sku-${value}`,
      label:
        value === UNASSIGNED_SKU_FILTER
          ? "SKU: Ninguno"
          : (availableSkus.find((sku) => sku.key === value)?.label ?? value),
      onRemove: () => setSkuFilter((current) => current.filter((item) => item !== value)),
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
    ...(hiddenOnly
      ? [{ key: "hidden", label: "Sólo ocultos", onRemove: () => setHiddenOnly(false) }]
      : []),
  ];
  const renderCategoryFilterNode = (node: AdminCategoryFilterNode, depth = 0) => {
    const checked = isCategoryFilterNodeCovered(node, categoryFilter);
    const hasSelectedDescendant = categoryFilter.some((key) => {
      const selectedNode = categoryFilterNodeMap.get(key);
      return Boolean(
        selectedNode &&
          selectedNode.brand === node.brand &&
          selectedNode.category === node.category &&
          selectedNode.path.length > node.path.length &&
          node.path.every((slug, index) => selectedNode.path[index] === slug),
      );
    });
    return (
      <div key={node.key} className="space-y-2">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => toggleCategoryFilterNode(node, value === true)}
          />
          <span className={depth === 0 ? "font-medium" : "text-muted-foreground"}>
            {node.path.length === 0 ? formatCategoryLabel(node.category) : node.label}
            {node.path.length === 0 ? (
              <span className="ml-1 text-xs text-muted-foreground">
                ({brandList.find((entry) => entry.slug === node.brand)?.shortName ?? node.brand})
              </span>
            ) : null}
          </span>
        </label>
        {node.children.length > 0 && (checked || hasSelectedDescendant) ? (
          <div className="ml-4 space-y-2 border-l border-border/60 pl-3">
            {node.children.map((child) => renderCategoryFilterNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-0 sm:px-6">
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
                        {availableCategoryNodes.map((node) => renderCategoryFilterNode(node))}
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
                      onClick={() => setSuppliersOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={suppliersOpen}
                      aria-controls="suppliers-list"
                    >
                      <span>Proveedores</span>
                      {supplierFilter.length > 0 && (
                        <Badge variant="secondary">{supplierFilter.length}</Badge>
                      )}
                      {suppliersOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {suppliersOpen && (
                      <div id="suppliers-list" className="space-y-2.5">
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={supplierFilter.length === 0}
                            onCheckedChange={() => setSupplierFilter([])}
                          />
                          <span className="font-medium">Todos</span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={supplierFilter.includes(UNASSIGNED_SUPPLIER_FILTER)}
                            onCheckedChange={(checked) =>
                              setSupplierFilter(checked ? [UNASSIGNED_SUPPLIER_FILTER] : [])
                            }
                          />
                          <span className="font-medium">Ninguno</span>
                        </label>
                        {availableSuppliers.map((supplier) => (
                          <label
                            key={supplier}
                            className="flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <Checkbox
                              checked={supplierFilter.includes(supplier)}
                              onCheckedChange={(checked) =>
                                setSupplierFilter((current) => {
                                  const namedSuppliers = current.filter(
                                    (value) => value !== UNASSIGNED_SUPPLIER_FILTER,
                                  );
                                  const next = checked
                                    ? [...namedSuppliers, supplier]
                                    : namedSuppliers.filter((value) => value !== supplier);
                                  return availableSuppliers.every((value) => next.includes(value))
                                    ? []
                                    : Array.from(new Set(next));
                                })
                              }
                            />
                            <span className="font-medium">{supplier}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSkusOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={skusOpen}
                      aria-controls="skus-list"
                    >
                      <span>SKU</span>
                      {skuFilter.length > 0 && (
                        <Badge variant="secondary">{skuFilter.length}</Badge>
                      )}
                      {skusOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {skusOpen && (
                      <div id="skus-list" className="max-h-48 space-y-2.5 overflow-y-auto">
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={skuFilter.length === 0}
                            onCheckedChange={() => setSkuFilter([])}
                          />
                          <span className="font-medium">Todos</span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-3 text-sm">
                          <Checkbox
                            checked={skuFilter.includes(UNASSIGNED_SKU_FILTER)}
                            onCheckedChange={(checked) =>
                              setSkuFilter(checked ? [UNASSIGNED_SKU_FILTER] : [])
                            }
                          />
                          <span className="font-medium">Ninguno</span>
                        </label>
                        {availableSkus.map((sku) => (
                          <label
                            key={sku.key}
                            className="flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <Checkbox
                              checked={skuFilter.includes(sku.key)}
                              onCheckedChange={(checked) =>
                                setSkuFilter((current) => {
                                  const selectedSkus = current.filter(
                                    (value) => value !== UNASSIGNED_SKU_FILTER,
                                  );
                                  const next = checked
                                    ? [...selectedSkus, sku.key]
                                    : selectedSkus.filter((value) => value !== sku.key);
                                  return availableSkus.every((option) => next.includes(option.key))
                                    ? []
                                    : Array.from(new Set(next));
                                })
                              }
                            />
                            <span className="font-medium">{sku.label}</span>
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

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5">
                      <Label
                        htmlFor="admin-filter-discount"
                        className="cursor-pointer text-xs sm:text-sm"
                      >
                        Sólo con descuento
                      </Label>
                      <Switch
                        id="admin-filter-discount"
                        checked={discountOnly}
                        onCheckedChange={setDiscountOnly}
                      />
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5">
                      <Label
                        htmlFor="admin-filter-stock"
                        className="cursor-pointer text-xs sm:text-sm"
                      >
                        Sólo con stock
                      </Label>
                      <Switch
                        id="admin-filter-stock"
                        checked={stockOnly}
                        onCheckedChange={setStockOnly}
                      />
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5">
                      <Label
                        htmlFor="admin-filter-available"
                        className="cursor-pointer text-xs sm:text-sm"
                      >
                        Sólo disponible
                      </Label>
                      <Switch
                        id="admin-filter-available"
                        checked={availableOnly}
                        onCheckedChange={setAvailableOnly}
                      />
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-surface-2/60 px-3 py-2.5">
                      <Label
                        htmlFor="admin-filter-hidden"
                        className="cursor-pointer text-xs sm:text-sm"
                      >
                        Sólo ocultos
                      </Label>
                      <Switch
                        id="admin-filter-hidden"
                        checked={hiddenOnly}
                        onCheckedChange={setHiddenOnly}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-4">
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
              Valor USD
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

      <div className="flex flex-col">
        <div
          className={cn(
            selectedProductIds.length > 0 &&
              "order-2 mt-2 flex min-h-9 basis-full flex-wrap items-center gap-3",
          )}
        >
          {selectedProductIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {quickEditProductId !== null ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    disabled={isSavingQuickEdit}
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
                        void saveQuickEdit(currentProduct, currentVariant);
                      }
                    }}
                  >
                    {isSavingQuickEdit ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )} Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cancelQuickEdit}
                    className="bg-green-700 text-white hover:bg-green-800 hover:text-white"
                  >
                    <ArrowRight className="size-4" /> Saltar
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkToggleProducts(false)}
                  >
                    <Eye className="size-4" /> Disponible
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkToggleProducts(true)}
                  >
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

        <div className="order-1">
          <FilterChipList chips={adminFilterChips} />
        </div>
        <div className="order-3 mt-2 rounded-2xl">
          <div className="glass-panel min-w-0 flex-1 overflow-visible rounded-2xl">
            <Table
              hideScrollbarOnMobile
              stickyHeader
              stickyScrollbar
              containerClassName="overflow-x-auto overflow-y-visible overscroll-x-contain"
              className={cn(
                "w-full min-w-72rem text-center text-sm [&_td]:align-middle [&_th]:align-middle [&_td]:py-2 [&_th]:py-2",
                quickEditProductId !== null ? "min-w-200 table-auto" : "table-fixed",
              )}
            >
              <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-center [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead className="w-12 min-w-12 max-w-12 px-2 text-center">
                    <div className="flex items-center justify-center">
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
                          const shouldSelect = checked === true || checked === "indeterminate";
                          scrollToTopOnFirstSelection(
                            selectedProductIds.length,
                            shouldSelect,
                            hasScrolledOnProductSelectionRef,
                          );
                          setSelectedProductIds((current) => {
                            const next = shouldSelect
                              ? Array.from(new Set([...current, ...visibleProductSelectionKeys]))
                              : current.filter((key) => !visibleProductSelectionKeys.includes(key));
                            if (next.length === 0) hasScrolledOnProductSelectionRef.current = false;
                            setSelectionMode(next.length > 0);
                            return next;
                          });
                        }}
                        aria-label="Seleccionar productos visibles"
                      />
                    </div>
                  </TableHead>
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
                  const isUnlimitedStock =
                    variant?.stockUnlimited ?? product.stockUnlimited ?? false;
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
                    displayGastosCurrency === "USD"
                      ? displayGastos * displayUsdRate
                      : displayGastos;
                  const displayProfit =
                    displayPriceCurrency === displayGastosCurrency
                      ? discountedPrice - displayGastos
                      : discountedPriceInArs - gastosInArs;
                  const displayProfitCurrency =
                    displayPriceCurrency === displayGastosCurrency ? displayPriceCurrency : "ARS";
                  const quickEditKey = getQuickEditKey(product, variant);
                  const rowKey = `${product.id}-${variant?.id ?? "base"}`;
                  const isQuickEditing =
                    quickEditProductId === product.id &&
                    quickEditVariantId === (variant?.id ?? null);
                  const isHighlightedDeepLink = highlightedDeepLinkKey === rowKey;
                  const quickDraft = quickEditForm[quickEditKey] ?? {
                    brand: product.brand,
                    name: product.name,
                    category: product.category,
                    price: product.price,
                    comision: String(product.comision ?? 0),
                    comisionCurrency: product.comisionCurrency ?? "ARS",
                    gastos: product.gastos ?? 0,
                    gastosCurrency: product.gastosCurrency ?? "ARS",
                    stock: product.stock,
                    stockUnlimited: variant?.stockUnlimited ?? product.stockUnlimited ?? false,
                    discount,
                    variantName: variant?.name ?? "",
                  };
                  const activeQuickBrand = quickDraft.brand ?? product.brand;

                  return (
                    <TableRow
                      id={`product-${rowKey}`}
                      key={rowKey}
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
                        isHighlightedDeepLink
                          ? "animate-pulse border border-amber-400/80 bg-linear-to-r from-amber-500/25 via-yellow-300/25 to-amber-500/25 shadow-[0_0_0_1px_rgba(251,191,36,0.55),0_0_18px_rgba(251,191,36,0.28)]"
                          : undefined,
                        !selectionMode && !isQuickEditing && "cursor-pointer hover:bg-transparent",
                      )}
                    >
                      <TableCell className="w-12 min-w-12 max-w-12 px-2 text-center">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            className="h-4 w-4 rounded-full border-2 border-primary bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                            checked={selectedProductIds.includes(
                              getProductSelectionKey(product, variant),
                            )}
                            onCheckedChange={(checked) =>
                              toggleProductSelection(
                                getProductSelectionKey(product, variant),
                                checked === true,
                              )
                            }
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
                            <div className="flex min-w-28 flex-col gap-1.5">
                              <Select
                                value={quickDraft.stockUnlimited ? "unlimited" : "limited"}
                                onValueChange={(value) =>
                                  setQuickEditForm((current) => ({
                                    ...current,
                                    [quickEditKey]: {
                                      ...quickDraft,
                                      stockUnlimited: value === "unlimited",
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger
                                  className="h-8 w-full"
                                  aria-label={`Tipo de stock de ${product.name}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="limited">Cantidad</SelectItem>
                                  <SelectItem value="unlimited">Infinito</SelectItem>
                                </SelectContent>
                              </Select>
                              {!quickDraft.stockUnlimited ? (
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
                                  aria-label={`Cantidad en stock de ${product.name}`}
                                />
                              ) : null}
                            </div>
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
                                step="any"
                                value={quickDraft.comision}
                                onChange={(event) =>
                                  setQuickEditForm((current) => ({
                                    ...current,
                                    [quickEditKey]: {
                                      ...quickDraft,
                                      comision: event.target.value,
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
                              quickDraft.price * (1 - quickDraft.discount / 100) -
                                quickDraft.gastos,
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="min-w-64 text-center">
                            <button
                              type="button"
                              className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2 text-center"
                              aria-label={`${selectedProductIds.includes(getProductSelectionKey(product, variant)) ? "Deseleccionar" : "Seleccionar"} ${product.name}${variant ? ` ${variant.name}` : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                const selectionKey = getProductSelectionKey(product, variant);
                                toggleProductSelection(
                                  selectionKey,
                                  !selectedProductIds.includes(selectionKey),
                                );
                              }}
                            >
                              <span className="min-w-0 w-full wrap-break-word font-medium text-center">
                                {product.name}
                              </span>
                              {variant ? (
                                <span className="inline-flex items-center text-[10px] uppercase tracking-wider">
                                  <span className="rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">
                                    {variant.name}
                                  </span>
                                </span>
                              ) : null}
                              {isProductRowHidden(product, variant) ? (
                                <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Oculto
                                </span>
                              ) : null}
                            </button>
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
      </div>
      <div className="mt-4 flex flex-col gap-3 pb-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToProductPage(0)}
            disabled={!hasPreviousPage}
            className="h-9 px-4"
          >
            Principio
          </Button>
          <div className="flex items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
            {getVisiblePaginationItems(page, totalPages).map((item, index) => {
              if (item === "ellipsis-left" || item === "ellipsis-right") {
                return (
                  <span
                    key={`${item}-${index}`}
                    className="px-2 text-muted-foreground"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const pageIndex = item - 1;
              return (
                <button
                  key={`page-${item}`}
                  type="button"
                  className={`h-9 min-w-9 rounded-xl border border-input px-3 py-1.5 text-sm outline-none transition-colors focus-visible:outline-none ${pageIndex === page ? "bg-muted text-foreground" : "bg-transparent text-muted-foreground hover:bg-surface-2"}`}
                  onClick={() => goToProductPage(pageIndex)}
                >
                  {item}
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => goToProductPage(totalPages - 1)}
            disabled={!hasNextPage}
            className="h-9 px-4"
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
            className="h-8 w-20 bg-background/50 text-center desktop-no-spinner"
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
          {displayRows.length} de {allDisplayRows.length} productos mostrados
        </p>
      </div>

      <input
        ref={multiProductInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const append = appendImportedProductsRef.current;
          appendImportedProductsRef.current = false;
          handleImportMultipleProducts(event.target.files, append);
          event.target.value = "";
        }}
      />

      <input
        ref={textProductInputRef}
        type="file"
        accept="text/*,.txt,.text,.md,.markdown,.csv,.tsv,.log,.ini,.json,.rtf,.doc,.docx,.pdf,.xls,.xlsx,.odt,.ods"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0] ?? null;
          const append = appendImportedProductsRef.current;
          appendImportedProductsRef.current = false;
          await handleImportTextProduct(file, append);
          event.target.value = "";
        }}
      />

      <input
        ref={importHeaderInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = Array.from(event.target.files ?? []).find((selected) =>
            selected.type.startsWith("image/"),
          );
          event.target.value = "";
          if (!file) return;
          try {
            const header = await optimizeImageDataUrl(await fileToDataUrl(file), 1200);
            if (header.length > 1_500_000) {
              throw new Error("La cabecera sigue siendo demasiado pesada. Elegí una imagen más pequeña.");
            }
            await persistImportHeaderImage(header);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo preparar la cabecera.");
          }
        }}
      />

      <Dialog open={createChoiceOpen} onOpenChange={setCreateChoiceOpen}>
        <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle>Agregar producto</DialogTitle>
            <DialogDescription>
              Elegí una opción para agregar nuevos productos al catálogo.
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
                setImportSetupSource("images");
                setImportBrand("arcade");
                setImportCategory("");
                setImportSubcategory("");
                setImportSubcategoryPath([]);
                setImportCode("");
                setImportAsVariant(false);
                setImportVariantName("");
                setApplyImportFieldsToAll(true);
                setImportSetupOpen(true);
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
                setImportSetupSource("text");
                setImportBrand("arcade");
                setImportCategory("");
                setImportSubcategory("");
                setImportSubcategoryPath([]);
                setImportCode("");
                setImportAsVariant(false);
                setImportVariantName("");
                setApplyImportFieldsToAll(true);
                setImportSetupOpen(true);
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>Importar desde un archivo</span>
                <span className="text-xs text-muted-foreground">TXT, Word, PDF o Excel</span>
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left"
              onClick={() => {
                setCreateChoiceOpen(false);
                setStoreImportLink("");
                setImportBrand("arcade");
                setImportCategory("");
                setImportSubcategory("");
                setImportSubcategoryPath([]);
                setImportCode("");
                setImportAsVariant(false);
                setImportVariantName("");
                setImportSetupSource("store");
                setApplyImportFieldsToAll(true);
                setImportSetupOpen(true);
              }}
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span>Importar desde la tienda Store</span>
                <span className="text-xs text-muted-foreground">Ingresar link</span>
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importSetupOpen}
        onOpenChange={(open) => {
          setCreateChoiceOpen(false);
          setImportSetupOpen(open);
          if (!open) setImportSetupSource(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar importación</DialogTitle>
            <DialogDescription>
              <span className="block">
                {importSetupSource === "images"
                  ? "Varios productos"
                  : importSetupSource === "text"
                    ? "Importar desde un archivo"
                    : "Importar desde la tienda Store."}
              </span>
              {importSetupSource === "text" ? (
                <span className="block">Formatos: TXT, CSV, RTF, DOCX, PDF, XLS/XLSX, ODT y ODS.</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <section className="space-y-2 rounded-xl border border-border/60 bg-surface/40 p-3">
            <Label>Cabecera de imagen para productos (opcional)</Label>
            <div className="flex flex-wrap items-center gap-3">
              {importHeaderImage ? (
                <img
                  src={importHeaderImage}
                  alt="Vista previa de la cabecera que se agregará sobre cada producto"
                  className="h-14 w-24 rounded-md border border-border/60 bg-background object-contain"
                />
              ) : (
                <div className="grid h-14 w-24 place-items-center rounded-md border border-dashed border-border/70 text-xs text-muted-foreground">
                  Sin cabecera
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={isSavingImportHeader}
                onClick={() => importHeaderInputRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {importHeaderImage ? "Cambiar cabecera" : "Subir cabecera"}
              </Button>
              {importHeaderImage ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSavingImportHeader}
                  onClick={() => void persistImportHeaderImage("")}
                >
                  Quitar
                </Button>
              ) : null}
              {isSavingImportHeader ? (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Se guarda para reutilizarla. Se agregará arriba, sin tapar la foto, en las imágenes
              importadas desde link, archivo o selección de imágenes.
            </p>
            {!isImportHeaderLoaded ? (
              <p className="text-xs text-muted-foreground">Cargando cabecera guardada…</p>
            ) : null}
          </section>
          <section className="space-y-2 rounded-xl border border-border/60 bg-surface/40 p-3">
            <div className="flex items-center gap-3">
              <Switch
                id="import-as-variant-mode"
                checked={importAsVariant}
                onCheckedChange={setImportAsVariant}
              />
              <Label htmlFor="import-as-variant-mode">Agregar como variante</Label>
            </div>
            {importAsVariant ? (
              <div className="space-y-1.5">
                <Label htmlFor="import-variant-name-global">Nombre de la variante</Label>
                <Input
                  id="import-variant-name-global"
                  value={importVariantName}
                  onChange={(event) => setImportVariantName(event.target.value)}
                  placeholder="Ej.: Cuenta secundaria"
                />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              El nombre se usará para las variantes de productos existentes y también se guardará
              como nombre de variante en los productos nuevos que no tengan coincidencia.
            </p>
          </section>
          {importSetupSource === "store" ? (
            <section className="space-y-3 rounded-xl border border-border/60 bg-surface/40 p-3">
              <div className="space-y-2">
                <Label htmlFor="store-import-link">Link de la categoría</Label>
                <Input
                  id="store-import-link"
                  type="url"
                  value={storeImportLink}
                  onChange={(event) => setStoreImportLink(event.target.value)}
                  placeholder="https://store.playstation.com/es-ar/category/..."
                  autoComplete="url"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="store-import-page-mode">Páginas a importar</Label>
                  <Select
                    value={storeImportPageMode}
                    onValueChange={(value) =>
                      setStoreImportPageMode(value as "all" | "single" | "range")
                    }
                  >
                    <SelectTrigger id="store-import-page-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las páginas</SelectItem>
                      <SelectItem value="single">Una página específica</SelectItem>
                      <SelectItem value="range">Desde una página hasta otra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {storeImportPageMode !== "all" ? (
                  storeImportPageMode === "single" ? (
                    <div className="space-y-2">
                      <Label htmlFor="store-import-page-number">Número de página</Label>
                      <Input
                        id="store-import-page-number"
                        type="number"
                        min={1}
                        max={1250}
                        step={1}
                        value={storeImportPageNumber}
                        onChange={(event) => setStoreImportPageNumber(event.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="store-import-page-number">Desde la página</Label>
                        <Input
                          id="store-import-page-number"
                          type="number"
                          min={1}
                          max={1250}
                          step={1}
                          value={storeImportPageNumber}
                          onChange={(event) => setStoreImportPageNumber(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="store-import-page-end-number">Hasta la página</Label>
                        <Input
                          id="store-import-page-end-number"
                          type="number"
                          min={Number(storeImportPageNumber) || 1}
                          max={1250}
                          step={1}
                          value={storeImportPageEndNumber}
                          onChange={(event) => setStoreImportPageEndNumber(event.target.value)}
                        />
                      </div>
                    </>
                  )
                ) : null}
              </div>
            </section>
          ) : null}
          <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="import-setup-brand">Tienda</Label>
              <Select
                value={importBrand}
                onValueChange={(value) => {
                  setImportBrand(value as BrandSlug);
                  setImportCategory("");
                  setImportSubcategory("");
                  setImportSubcategoryPath([]);
                  setImportCode("");
                }}
              >
                <SelectTrigger id="import-setup-brand">
                  <SelectValue placeholder="Opcional" />
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
              <Label htmlFor="import-setup-category">Categoría</Label>
              <Select
                value={importCategory || "none"}
                onValueChange={(value) => {
                  setImportCategory(value === "none" ? "" : value);
                  setImportSubcategory("");
                  setImportSubcategoryPath([]);
                }}
              >
                <SelectTrigger id="import-setup-category">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {brands[importBrand].categories.map((category) => (
                    <SelectItem key={category.slug} value={category.slug}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {importCategory
              ? Array.from({ length: importSubcategoryPath.length + 1 }, (_, level) => {
                  const options = getSubcategoryOptionsAtLevel(
                    selectedImportCategory?.subcategories,
                    importSubcategoryPath,
                    level,
                  );
                  if (!options.length) return null;
                  return (
                    <div key={`import-setup-subcategory-${level}`} className="space-y-2">
                      <Label htmlFor={`import-setup-subcategory-${level}`}>
                        {level === 0 ? "Subcategoría" : `Subcategoría ${level + 1}`}
                      </Label>
                      <Select
                        value={importSubcategoryPath[level] ?? "none"}
                        onValueChange={(value) => {
                          const nextPath = importSubcategoryPath.slice(0, level);
                          if (value !== "none") nextPath.push(value);
                          setImportSubcategoryPath(nextPath);
                          setImportSubcategory(nextPath[0] ?? "");
                        }}
                      >
                        <SelectTrigger id={`import-setup-subcategory-${level}`}>
                          <SelectValue placeholder="Opcional" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin subcategoría</SelectItem>
                          {options.map((subcategory) => (
                            <SelectItem key={subcategory.slug} value={subcategory.slug}>
                              {subcategory.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })
              : null}
            <div className="space-y-2">
              <Label htmlFor="import-setup-code">SKU</Label>
              <Select
                value={importCode || "none"}
                onValueChange={(value) => setImportCode(value === "none" ? "" : value)}
              >
                <SelectTrigger id="import-setup-code" className="w-full">
                  <SelectValue placeholder="Seleccionar SKU" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin SKU</SelectItem>
                  {availableSkus
                    .filter((sku) => sku.brand === importBrand)
                    .map((sku) => (
                      <SelectItem key={sku.key} value={sku.code}>
                        {sku.code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="w-full sm:col-span-2 lg:col-span-1"
              disabled={
                isPreparingImport ||
                !isImportHeaderLoaded ||
                isSavingImportHeader ||
                (importAsVariant && !importVariantName.trim()) ||
                (importSetupSource === "store" && !storeImportLink.trim())
              }
              onClick={() => {
                if (importSetupSource === "store") {
                  void handleImportFromStore();
                  return;
                }
                setIsPreparingImport(true);
                window.setTimeout(() => {
                  setCreateChoiceOpen(false);
                  setImportSetupOpen(false);
                  setApplyImportFieldsToAll(true);
                  appendImportedProductsRef.current = false;
                  if (importSetupSource === "images") multiProductInputRef.current?.click();
                  if (importSetupSource === "text") textProductInputRef.current?.click();
                  window.setTimeout(() => setIsPreparingImport(false), 250);
                }, 180);
              }}
            >
              <span className="inline-flex items-center gap-2 text-current">
                <span>
                  {isPreparingImport
                    ? "Cargando..."
                    : importSetupSource === "store"
                      ? "Consultar Store"
                      : "Continuar"}
                </span>
                {!isPreparingImport ? <ArrowRight className="size-4 text-current" /> : null}
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importCategoryOpen}
        onOpenChange={(open) => {
          if (!open && (isImportingStore || isPreparingImport || isSavingImports)) return;
          setImportCategoryOpen(open);
        }}
      >
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>
              {isImportingStore
                ? "Cargando productos de PlayStation Store…"
                : isPreparingImport
                  ? "Cargando productos…"
                  : isSavingImports
                    ? "Aplicando cambios…"
                    : "Revisar productos antes de importar"}
            </DialogTitle>
            <DialogDescription>
              {isImportingStore
                ? "Consultando todas las páginas de la categoría. Esto puede tardar un poco."
                : isSavingImports
                  ? "Estamos guardando los productos y actualizando el catálogo."
                  : isPreparingImport
                    ? "Estamos procesando los archivos y preparando la vista previa."
                    : `Se encontraron ${pendingImportedProducts.length} productos. Revisá y editá los datos antes de agregarlos.`}
            </DialogDescription>
          </DialogHeader>
          {isImportingStore || isPreparingImport ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <LoaderCircle className="size-8 animate-spin text-primary" />
              <p>
                {isImportingStore
                  ? "Buscando productos y precios en todas las páginas…"
                  : "Leyendo archivos y cargando productos…"}
              </p>
              <p className="text-xs">Esperá un momento mientras se completa el proceso.</p>
            </div>
          ) : null}
          {isSavingImports ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
              <LoaderCircle className="size-8 animate-spin text-primary" />
              <p>Guardando productos y aplicando cambios…</p>
              <p className="text-xs">No cierres esta ventana hasta que termine.</p>
            </div>
          ) : null}
          <div
            className={cn(
              "space-y-4",
              (isImportingStore || isPreparingImport || isSavingImports) && "hidden",
            )}
          >
            <section className="space-y-3 rounded-2xl border border-border/60 bg-surface/40 p-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                General
              </h3>
              <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="import-code-all">SKU</Label>
                    <Select
                      value={importCode || "none"}
                      onValueChange={(value) => {
                        const code = value === "none" ? "" : value;
                        setImportCode(code);
                        setPendingImportedProducts((current) =>
                          current.map((product) => ({ ...product, code: code || undefined })),
                        );
                      }}
                    >
                      <SelectTrigger id="import-code-all" className="w-full">
                        <SelectValue placeholder="Seleccionar SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin SKU</SelectItem>
                        {availableSkus
                          .filter((sku) => sku.brand === importBrand)
                          .map((sku) => (
                            <SelectItem key={sku.key} value={sku.code}>
                              {sku.code}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="import-brand">Tienda</Label>
                    <Select
                      value={importBrand}
                      onValueChange={(value) => {
                        const nextBrand = value as BrandSlug;
                        changeGlobalImportFields(
                          nextBrand,
                          brands[nextBrand].categories[0]?.slug ?? "",
                          [],
                        );
                      }}
                    >
                      <SelectTrigger id="import-brand" className="w-full">
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
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="import-category">Categoría</Label>
                    <Select
                      value={importCategory || "none"}
                      onValueChange={(value) =>
                        changeGlobalImportFields(importBrand, value === "none" ? "" : value, [])
                      }
                    >
                      <SelectTrigger id="import-category" className="w-full">
                        <SelectValue placeholder="Seleccioná una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {importCategories.map((category) => (
                          <SelectItem key={category.slug} value={category.slug}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="import-subcategory-0">Subcategoría</Label>
                    {importCategory ? (
                      <div className="flex min-w-0 gap-2">
                        {Array.from({ length: importSubcategoryPath.length + 1 }, (_, level) => {
                          const options = getSubcategoryOptionsAtLevel(
                            selectedImportCategory?.subcategories,
                            importSubcategoryPath,
                            level,
                          );
                          if (!options.length) return null;
                          return (
                            <Select
                              key={`import-global-subcategory-${level}`}
                              value={importSubcategoryPath[level] ?? "none"}
                              onValueChange={(value) => {
                                const nextPath = importSubcategoryPath.slice(0, level);
                                if (value !== "none") nextPath.push(value);
                                changeGlobalImportFields(importBrand, importCategory, nextPath);
                              }}
                            >
                              <SelectTrigger
                                id={`import-subcategory-${level}`}
                                className="min-w-0 flex-1"
                                aria-label={`Subcategoría ${level + 1}`}
                              >
                                <SelectValue placeholder="Seleccioná" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin subcategoría</SelectItem>
                                {options.map((subcategory) => (
                                  <SelectItem key={subcategory.slug} value={subcategory.slug}>
                                    {subcategory.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-9 items-center rounded-md border border-input px-3 text-sm text-muted-foreground">
                        Elegí una categoría
                      </div>
                    )}
                  </div>
                  {importAsVariant ? (
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="import-variant-name-all">Nombre de variante</Label>
                      <Input
                        id="import-variant-name-all"
                        value={importVariantName}
                        onChange={(event) => {
                          const variantName = event.target.value;
                          setImportVariantName(variantName);
                          setPendingImportedProducts((current) =>
                            current.map((product) => ({ ...product, variantName })),
                          );
                          setImportedVariantChoices((current) =>
                            Object.fromEntries(
                              Object.entries(current).map(([productId, choice]) => [
                                productId,
                                { ...choice, variantName, existingVariantAction: undefined },
                              ]),
                            ),
                          );
                        }}
                        placeholder="Ej.: Secundario"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-2xl border border-border/60 bg-surface/40 p-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Productos
              </h3>
              {/* prettier-ignore */}
              <div className="max-h-[48dvh] space-y-3 overflow-y-auto pr-1">
              {pendingImportedProducts
                .slice(importPreviewPage * 30, (importPreviewPage + 1) * 30)
                .map((product, visibleIndex) => {
                  const index = importPreviewPage * 30 + visibleIndex;
                  const previewImage =
                    product.images?.[0] ?? storeImportPriceDetails[product.id]?.image;
                  return (
                    <div
                      key={product.id}
                      className="grid min-w-0 gap-3 overflow-hidden rounded-xl border border-border/60 bg-background/70 p-3"
                    >
                      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[11rem_repeat(4,minmax(0,1fr))]">
                        <div className="order-first grid w-full min-w-0 justify-items-center gap-2 lg:col-start-1 lg:row-span-2 lg:row-start-1">
                          <div className="relative size-24 shrink-0">
                            {previewImage ? (
                              <button
                                type="button"
                                className="group relative size-24 overflow-hidden rounded-lg border border-border/60 bg-background"
                                aria-label={`Ver imagen completa de ${product.name}`}
                                title="Tocar para ver imagen completa"
                                onClick={() =>
                                  setImportImageViewer({ image: previewImage, label: product.name })
                                }
                              >
                                <img
                                  src={previewImage}
                                  alt={`Vista previa de ${product.name}`}
                                  className="size-full object-contain"
                                />
                                <span className="absolute inset-x-0 bottom-0 bg-black/65 py-1 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                                  Ver completa
                                </span>
                              </button>
                            ) : (
                              <div className="grid size-24 place-items-center rounded-lg border border-border/60 bg-surface/50 text-muted-foreground">
                                <ImagePlus className="size-5" />
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute -right-2 -top-2 size-7 rounded-full border border-border/70 bg-background/95 text-white hover:bg-surface hover:text-white"
                              aria-label={`Quitar ${product.name} de la importación`}
                              title="Quitar producto"
                              disabled={applyingImportFieldsFromProductId !== null || isSavingImports}
                              onClick={() => removeImportedProduct(product.id)}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                          <input
                            ref={(node) => {
                              additionalImagesInputRefs.current[product.id] = node;
                            }}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (event) => {
                              const file = Array.from(event.target.files ?? []).find((selectedFile) =>
                                selectedFile.type.startsWith("image/"),
                              );
                              event.target.value = "";
                              if (!file) return;
                              try {
                                const croppedReplacement = await optimizeImageDataUrl(
                                  await cropImageDataUrl(await fileToDataUrl(file)),
                                );
                                const replacementImage =
                                  (
                                    await composeImportedImages(
                                      [croppedReplacement],
                                      importProductHeaders[product.id] ?? importHeaderImage,
                                    )
                                  )[0] ??
                                  croppedReplacement;
                                setPendingImportedProducts((current) =>
                                  current.map((item) =>
                                    item.id === product.id
                                      ? {
                                          ...item,
                                          images: [replacementImage, ...(item.images ?? []).slice(1)],
                                        }
                                      : item,
                                  ),
                                );
                                  if (importSource === "store") {
                                    setStoreImportPriceDetails((current) => ({
                                      ...current,
                                      [product.id]: {
                                        ...current[product.id],
                                        platforms: current[product.id]?.platforms ?? [],
                                        image: croppedReplacement,
                                      },
                                    }));
                                  }
                                toast.success("Imagen reemplazada");
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "No se pudo cambiar la imagen.",
                                );
                              }
                            }}
                          />
                          {importSource === "store" && pendingImportedProducts.length > 1 ? (
                            <input
                              ref={(node) => {
                                productHeaderInputRefs.current[product.id] = node;
                              }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => {
                                const file = Array.from(event.target.files ?? []).find((selectedFile) =>
                                  selectedFile.type.startsWith("image/"),
                                );
                                event.target.value = "";
                                if (file) void addHeaderToImportedProduct(product, file);
                              }}
                            />
                          ) : null}
                          <div className="flex w-full min-w-0 flex-col gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-auto! min-h-10 w-full justify-center whitespace-normal px-2 py-1 text-center text-xs leading-tight"
                              onClick={() => additionalImagesInputRefs.current[product.id]?.click()}
                            >
                              <ImagePlus className="size-3.5 shrink-0" /> Cambiar imagen
                            </Button>
                            {importSource === "store" && pendingImportedProducts.length > 1 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-auto! min-h-10 w-full justify-center whitespace-normal px-2 py-1 text-center text-xs leading-tight"
                                disabled={applyingImportFieldsFromProductId !== null || isSavingImports}
                                onClick={() => productHeaderInputRefs.current[product.id]?.click()}
                              >
                                <ImagePlus className="size-3.5 shrink-0" />
                                {importProductHeaders[product.id] ? "Cambiar cabecera" : "Agregar cabecera"}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-auto! min-h-10 w-full justify-center whitespace-normal px-2 py-1 text-center text-xs leading-tight"
                              aria-label={`Aplicar los datos de ${product.name} a los demás productos`}
                              title={
                                importSource === "store"
                                  ? "Aplicar los datos del producto a los demás"
                                  : "Aplicar los datos, excepto nombre, imagen y Mi comisión"
                              }
                              disabled={
                                pendingImportedProducts.length < 2 ||
                                applyingImportFieldsFromProductId !== null ||
                                isSavingImports ||
                                lastAppliedImportSignature === pendingImportSignature
                              }
                              onClick={() => void applyImportedProductFieldsToAll(product.id)}
                            >
                              {applyingImportFieldsFromProductId === product.id ? (
                                <LoaderCircle className="size-4 shrink-0 animate-spin" />
                              ) : (
                                <Check className="size-4 shrink-0" />
                              )}
                              <span>
                                {applyingImportFieldsFromProductId === product.id
                                  ? "Aplicando…"
                                  : "Aplicar a todos"}
                              </span>
                            </Button>
                          </div>
                        </div>
                          <div className="contents">
                          <div className="order-1 min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1 lg:col-start-2 lg:row-start-1">
                            <div className="flex min-h-8 items-center">
                              <Label htmlFor={`import-name-${product.id}`}>
                                Nombre del producto
                              </Label>
                            </div>
                            <Input
                              id={`import-name-${product.id}`}
                              value={product.name}
                              onChange={(event) =>
                                setPendingImportedProducts((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              className="min-w-0"
                            />
                          </div>
                          {importSource !== "store" ? (
                            <>
                              <div className="order-3 min-w-0 space-y-1.5 lg:col-start-4 lg:row-start-1">
                                <div className="flex min-h-8 flex-wrap items-center justify-between gap-1">
                                  <Label htmlFor={`import-expenses-${product.id}`}>Gastos</Label>
                                  <Select
                                    value={product.gastosCurrency ?? "ARS"}
                                    onValueChange={(value) =>
                                      setPendingImportedProducts((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, gastosCurrency: value as CurrencyCode }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ARS">$ (ARS)</SelectItem>
                                      <SelectItem value="USD">USD (Dólar)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Input
                                  id={`import-expenses-${product.id}`}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={product.gastos ?? 0}
                                  onChange={(event) =>
                                    setPendingImportedProducts((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, gastos: Number(event.target.value) }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="min-w-0"
                                />
                              </div>
                              <div className="order-4 min-w-0 space-y-1.5 lg:col-start-5 lg:row-start-1">
                                <div className="flex min-h-8 flex-wrap items-center justify-between gap-1">
                                  <Label htmlFor={`import-profit-${product.id}`}>Mi comisión</Label>
                                  <Select
                                    value={product.comisionCurrency ?? "ARS"}
                                    onValueChange={(value) =>
                                      setPendingImportedProducts((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, comisionCurrency: value as CurrencyCode }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-24">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ARS">$ (ARS)</SelectItem>
                                      <SelectItem value="USD">USD (Dólar)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Input
                                  id={`import-profit-${product.id}`}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={product.comision ?? 0}
                                  onChange={(event) =>
                                    setPendingImportedProducts((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, comision: Number(event.target.value) }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="min-w-0"
                                />
                              </div>
                            </>
                          ) : null}
                          {importSource === "store" ? (
                            <>
                              <div className="order-4 min-w-0 space-y-1.5 lg:col-start-5 lg:row-start-1">
                                <Label>Mi ganancia</Label>
                                <div className="flex min-w-0 gap-2">
                                  <Select
                                    value={product.comisionCurrency ?? "ARS"}
                                    onValueChange={(value) =>
                                      setPendingImportedProducts((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, comisionCurrency: value as CurrencyCode }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-24 shrink-0">
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
                                    value={product.comision ?? 0}
                                    onChange={(event) =>
                                      setPendingImportedProducts((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, comision: Number(event.target.value) }
                                            : item,
                                        ),
                                      )
                                    }
                                    className="min-w-0"
                                  />
                                </div>
                              </div>
                              <div className="order-3 min-w-0 space-y-1.5 lg:col-start-4 lg:row-start-1">
                                <Label>Gastos</Label>
                                <div className="flex min-w-0 gap-2">
                                  <Select
                                    value={product.gastosCurrency ?? "USD"}
                                    onValueChange={(value) =>
                                      setPendingImportedProducts((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, gastosCurrency: value as CurrencyCode }
                                            : item,
                                        ),
                                      )
                                    }
                                  >
                                    <SelectTrigger className="w-24 shrink-0">
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
                                    step="0.01"
                                    value={product.gastos ?? 0}
                                    onChange={(event) =>
                                      setPendingImportedProducts((current) =>
                                        current.map((item, itemIndex) =>
                                          itemIndex === index
                                            ? { ...item, gastos: Number(event.target.value) }
                                            : item,
                                        ),
                                      )
                                    }
                                    className="min-w-0"
                                  />
                                </div>
                                {storeImportPriceDetails[product.id] ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    Store: oferta{" "}
                                    {storeImportPriceDetails[product.id]?.offer ?? "—"} · normal{" "}
                                    {storeImportPriceDetails[product.id]?.regular ?? "—"}
                                  </p>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                        <div className="contents">
                          <div className="order-2 min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-1">
                            <div className="flex min-h-8 items-center">
                              <Label htmlFor={`import-supplier-${product.id}`}>Proveedor</Label>
                            </div>
                            <Select
                              value={product.supplier?.name ? getSupplierKey(product.supplier) : "none"}
                              onValueChange={(value) => {
                                const supplier = importSupplierOptions.find(
                                  (option) => getSupplierKey(option) === value,
                                );
                                updateImportedProduct(product.id, {
                                  supplier: value === "none" ? undefined : supplier,
                                });
                              }}
                            >
                              <SelectTrigger id={`import-supplier-${product.id}`}>
                                <SelectValue placeholder="Seleccionar proveedor" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Sin proveedor</SelectItem>
                                {importSupplierOptions.map((supplier) => (
                                  <SelectItem key={getSupplierKey(supplier)} value={getSupplierKey(supplier)}>
                                    {supplier.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="order-5 min-w-0 space-y-1.5 lg:col-start-2 lg:row-start-2">
                            <Label htmlFor={`import-stock-mode-${product.id}`}>Stock</Label>
                            <Select
                              value={product.stockUnlimited ? "unlimited" : "limited"}
                              onValueChange={(value) =>
                                updateImportedProduct(product.id, {
                                  stockUnlimited: value === "unlimited",
                                })
                              }
                            >
                              <SelectTrigger id={`import-stock-mode-${product.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="limited">Cantidad</SelectItem>
                                <SelectItem value="unlimited">Ilimitado</SelectItem>
                              </SelectContent>
                            </Select>
                            {!product.stockUnlimited ? (
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                aria-label={`Cantidad en stock de ${product.name}`}
                                value={product.stock}
                                onChange={(event) =>
                                  updateImportedProduct(product.id, {
                                    stock: Math.max(0, Number(event.target.value) || 0),
                                  })
                                }
                              />
                            ) : null}
                          </div>
                          <div className="order-6 min-w-0 space-y-1.5 lg:col-start-3 lg:row-start-2">
                            <Label htmlFor={`import-delivery-unit-${product.id}`}>Tiempo de entrega</Label>
                            <Select
                              value={product.deliveryUnit ?? "inmediata"}
                              onValueChange={(value) =>
                                updateImportedProduct(product.id, {
                                  deliveryUnit: value as DeliveryUnit,
                                  deliveryAmount: value === "inmediata" ? 0 : product.deliveryAmount ?? 1,
                                })
                              }
                            >
                              <SelectTrigger id={`import-delivery-unit-${product.id}`}>
                                <SelectValue placeholder="Seleccionar tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="inmediata">Inmediata</SelectItem>
                                <SelectItem value="horas">Horas</SelectItem>
                                <SelectItem value="dias">Días</SelectItem>
                              </SelectContent>
                            </Select>
                            {product.deliveryUnit === "horas" || product.deliveryUnit === "dias" ? (
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                aria-label={`Tiempo de entrega de ${product.name}`}
                                value={product.deliveryAmount ?? 1}
                                onChange={(event) =>
                                  updateImportedProduct(product.id, {
                                    deliveryAmount: Math.max(1, Number(event.target.value) || 1),
                                  })
                                }
                              />
                            ) : null}
                          </div>
                          <div className="order-7 min-w-0 space-y-1.5 sm:col-span-2 lg:col-span-2 lg:col-start-4 lg:row-start-2">
                            <Label htmlFor={`import-description-${product.id}`}>Descripción</Label>
                            <Textarea
                              id={`import-description-${product.id}`}
                              value={product.description ?? ""}
                              onChange={(event) =>
                                updateImportedProduct(product.id, {
                                  short: event.target.value,
                                  description: event.target.value,
                                })
                              }
                              rows={2}
                              className="min-h-20 w-full resize-y"
                              placeholder="Escribí una descripción para este producto"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                onClick={addMoreImportedProducts}
                disabled={!importSource || isImportingStore}
              >
                <Plus className="size-4" />
                Agregar productos
              </Button>
              {pendingImportedProducts.length > 30 ? (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    Productos {importPreviewPage * 30 + 1}–
                    {Math.min((importPreviewPage + 1) * 30, pendingImportedProducts.length)} de{" "}
                    {pendingImportedProducts.length}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={importPreviewPage === 0}
                      onClick={() => setImportPreviewPage((current) => Math.max(0, current - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={(importPreviewPage + 1) * 30 >= pendingImportedProducts.length}
                      onClick={() => setImportPreviewPage((current) => current + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
          <DialogFooter
            className={cn(
              "gap-2 space-x-0 max-md:justify-end max-md:pt-3",
              (isImportingStore || isPreparingImport || isSavingImports) && "hidden",
            )}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportCategoryOpen(false);
                setPendingImportedProducts([]);
              }}
            >
              <X className="size-4" />
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmMultipleImport}
              disabled={
                isSavingImports ||
                !pendingImportedProducts.length ||
                pendingImportedProducts.some(
                  (product) =>
                    !product.name.trim() ||
                    !Number.isFinite(getImportedSalePrice(product)) ||
                    getImportedSalePrice(product) < 0,
                )
              }
            >
              <Check className="size-4" /> Confirmar productos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(importImageViewer)}
        onOpenChange={(open) => {
          if (!open) setImportImageViewer(null);
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Imagen completa: {importImageViewer?.label ?? "Producto"}</DialogTitle>
            <DialogDescription>
              Vista completa de la imagen que se guardará con este producto.
            </DialogDescription>
          </DialogHeader>
          {importImageViewer ? (
            <div className="grid max-h-[75dvh] min-h-48 place-items-center overflow-auto rounded-xl border border-border/60 bg-black/20 p-2">
              <img
                src={importImageViewer.image}
                alt={`Imagen completa de ${importImageViewer.label}`}
                className="max-h-[70dvh] max-w-full object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={duplicateReviewOpen}
        onOpenChange={(open) => {
          if (!open && isSavingImports) return;
          setDuplicateReviewOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Productos con el mismo nombre</DialogTitle>
            <DialogDescription>
              Encontré {duplicateCandidateIds.length} productos cuyo nombre coincide exactamente
              con uno del catálogo. Elegí si querés agregarlo aparte, omitirlo o incorporarlo como
              una variante del producto que ya existe.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
            {pendingImportedProducts
              .filter((product) => duplicateCandidateIds.includes(product.id))
              .slice(importPreviewPage * 30, (importPreviewPage + 1) * 30)
              .map((product) => {
                const matches = getDuplicateMatches(product);
                const variantMatches = getVariantMatches(product);
                const isKept = keepDuplicateIds.includes(product.id);
                const variantChoice = importedVariantChoices[product.id];
                const selectedTarget = variantMatches.find(
                  (match) => match.id === variantChoice?.targetProductId,
                );
                const existingVariantConflict = variantChoice?.variantName.trim()
                  ? selectedTarget?.variants?.find(
                      (variant) =>
                        normalizeImportedVariantName(variant.name) ===
                        normalizeImportedVariantName(variantChoice.variantName),
                    )
                  : undefined;
                return (
                  <div
                    key={product.id}
                    className="space-y-3 rounded-xl border border-border/60 bg-background/70 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isKept}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            setImportedVariantChoices((current) => {
                              const next = { ...current };
                              delete next[product.id];
                              return next;
                            });
                          }
                          setKeepDuplicateIds((current) =>
                            checked === true
                              ? [...new Set([...current, product.id])]
                              : current.filter((id) => id !== product.id),
                          );
                        }}
                        aria-label={`Agregar igualmente ${product.name} como producto independiente`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{product.name}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          Producto existente: {matches.map((match) => match.name).join(" · ")}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {variantChoice
                            ? existingVariantConflict
                              ? variantChoice.existingVariantAction === "replace"
                                ? `Se reemplazarán los datos de la variante «${existingVariantConflict.name}»`
                                : variantChoice.existingVariantAction === "skip"
                                  ? `Se conservará «${existingVariantConflict.name}» y se omitirá esta importación`
                                  : `Ya existe la variante «${existingVariantConflict.name}»; elegí qué hacer`
                              : `Se agregará como variante de ${selectedTarget?.name ?? "un producto existente"}`
                            : isKept
                              ? "Se agregará como producto independiente"
                              : "Se omitirá"}
                        </span>
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`import-as-variant-${product.id}`}
                          checked={Boolean(variantChoice)}
                          disabled={variantMatches.length === 0}
                          onCheckedChange={(checked) => {
                            if (checked === true) {
                              const firstMatch = variantMatches[0];
                              if (!firstMatch) return;
                              setKeepDuplicateIds((current) => current.filter((id) => id !== product.id));
                              setImportedVariantChoices((current) => ({
                                ...current,
                                [product.id]: {
                                  targetProductId: firstMatch.id,
                                  variantName: importAsVariant
                                    ? product.variantName?.trim() || importVariantName.trim()
                                    : product.variantName?.trim() || "",
                                },
                              }));
                              return;
                            }
                            setImportedVariantChoices((current) => {
                              const next = { ...current };
                              delete next[product.id];
                              return next;
                            });
                          }}
                        />
                        <Label htmlFor={`import-as-variant-${product.id}`}>
                          Incorporar como variante de un producto existente
                        </Label>
                      </div>
                      {variantChoice ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor={`import-variant-target-${product.id}`}>
                              Producto base
                            </Label>
                            <Select
                              value={variantChoice.targetProductId}
                              onValueChange={(targetProductId) =>
                                setImportedVariantChoices((current) => ({
                                  ...current,
                                  [product.id]: {
                                    ...variantChoice,
                                    targetProductId,
                                    existingVariantAction: undefined,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger id={`import-variant-target-${product.id}`}>
                                <SelectValue placeholder="Elegí producto base" />
                              </SelectTrigger>
                              <SelectContent>
                                {variantMatches.map((match) => (
                                  <SelectItem key={match.id} value={match.id}>
                                    {match.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`import-variant-name-${product.id}`}>
                              Nombre de variante
                            </Label>
                            <Input
                              id={`import-variant-name-${product.id}`}
                              value={variantChoice.variantName}
                              placeholder="Ej.: Secundaria"
                              onChange={(event) =>
                                setImportedVariantChoices((current) => ({
                                  ...current,
                                  [product.id]: {
                                    ...variantChoice,
                                    variantName: event.target.value,
                                    existingVariantAction: undefined,
                                  },
                                }))
                              }
                            />
                          </div>
                          {existingVariantConflict ? (
                            <div className="space-y-2 sm:col-span-2">
                              <p className="text-sm text-amber-500">
                                Este producto ya tiene una variante con ese nombre. ¿Querés reemplazar
                                sus datos? El producto base y el identificador de la variante se conservan.
                              </p>
                              <Select
                                value={variantChoice.existingVariantAction ?? ""}
                                onValueChange={(value) =>
                                  setImportedVariantChoices((current) => ({
                                    ...current,
                                    [product.id]: {
                                      ...variantChoice,
                                      existingVariantAction: value as "replace" | "skip",
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger aria-label={`Decidir sobre la variante ${existingVariantConflict.name}`}>
                                  <SelectValue placeholder="Elegí qué hacer" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="replace">Sí, reemplazar los datos</SelectItem>
                                  <SelectItem value="skip">No, conservarla y omitir</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
          {duplicateCandidateIds.length > 30 ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <p className="text-muted-foreground">
                Coincidencias {importPreviewPage * 30 + 1}–
                {Math.min((importPreviewPage + 1) * 30, duplicateCandidateIds.length)} de{" "}
                {duplicateCandidateIds.length}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={importPreviewPage === 0}
                  onClick={() => setImportPreviewPage((current) => Math.max(0, current - 1))}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={(importPreviewPage + 1) * 30 >= duplicateCandidateIds.length}
                  onClick={() => setImportPreviewPage((current) => current + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingImports}
              onClick={() => {
                setDuplicateReviewOpen(false);
                setImportCategoryOpen(true);
              }}
            >
              Volver a revisar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingImports}
              onClick={handleIncorporateAllDuplicates}
            >
              <ListPlus className="mr-2 size-4" /> Incorporar todos
            </Button>
            <Button type="button" onClick={handleResolveDuplicates} disabled={isSavingImports}>
              {isSavingImports ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Check className="mr-2 size-4" />
              )}
              {isSavingImports
                ? "Guardando…"
                : "Confirmar agregados"}
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
        onSkipBulkEdit={() => {}}
        canSkipBulkEdit={false}
        onSave={handleSaveProduct}
        isSaving={isSavingProduct}
        supplierProducts={products}
      />
      <ProductEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setEditDialogOpen(true);
          } else {
            closeProductEditor();
          }
        }}
        mode="edit"
        productForm={productForm}
        setProductForm={setProductForm}
        configuredUsdRate={usdRate}
        initialVariantId={initialVariantId}
        bulkEditPosition={bulkEditQueue.length > 0 ? bulkEditPosition : -1}
        bulkEditCount={bulkEditQueue.length}
        onNavigateBulkEdit={navigateBulkEditProduct}
        onSkipBulkEdit={skipBulkEditProduct}
        canSkipBulkEdit={isBulkEditSession && bulkEditQueue.length > 0}
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
                    void handleDeleteProduct(productId, variantId).then((deleted) => {
                      if (!deleted) return;
                      const queue = bulkEditQueueRef.current;
                      const currentSelectionKey = variantId
                        ? `${productId}:${variantId}`
                        : productId;
                      if (!queue.includes(currentSelectionKey)) {
                        closeProductEditor();
                        return;
                      }

                      const productStillExists = (productsData as Product[]).some(
                        (product) => product.id === productId,
                      );
                      const removedKeys = productStillExists
                        ? [currentSelectionKey]
                        : queue.filter(
                            (selectionKey) =>
                              selectionKey === productId ||
                              selectionKey.startsWith(`${productId}:`),
                          );
                      moveBulkEditToPrevious(currentSelectionKey, removedKeys);
                    });
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
  onSkipBulkEdit,
  canSkipBulkEdit,
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
  onSkipBulkEdit: () => void;
  canSkipBulkEdit: boolean;
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
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const initialFormRef = useRef<string | null>(null);
  const productFormRef = useRef<ProductFormState | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variantNameDraft, setVariantNameDraft] = useState("");
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [inlineVariantName, setInlineVariantName] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [perfumeNotesDialogOpen, setPerfumeNotesDialogOpen] = useState(false);
  const [perfumeNotesResult, setPerfumeNotesResult] = useState<PerfumeNotesResult | null>(null);
  const [perfumeNotesError, setPerfumeNotesError] = useState("");
  const [isSearchingPerfumeNotes, setIsSearchingPerfumeNotes] = useState(false);
  const descriptionAppliedRef = useRef("");
  const featuresAppliedRef = useRef("");
  const includesAppliedRef = useRef("");
  const [supplierOptions, setSupplierOptions] = useState<ProductSupplier[]>([]);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState<ProductSupplier>({
    name: "",
    phone: "",
    social: "",
    references: "",
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
      setNewSupplier({
        name: "",
        phone: "",
        social: "",
        references: "",
        purchaseDate: "",
      });
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
      references: newSupplier.references?.trim() ?? "",
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
    if (!imageFiles.length) {
      toast.error("El archivo seleccionado no es una imagen válida.");
      return;
    }

    try {
      const imageDataUrls = await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const resized = await optimizeImageDataUrl(await fileToDataUrl(file));
            return await optimizeImageDataUrl(await cropImageDataUrl(resized));
          } catch (error) {
            const reason = error instanceof Error ? error.message : "Error desconocido.";
            throw new Error(`${file.name}: ${reason}`);
          }
        }),
      );

      setProductForm({
        ...productForm,
        images: [...productForm.images, ...imageDataUrls],
      });
    } catch (error) {
      console.error("Product image processing failed", error);
      toast.error(error instanceof Error ? error.message : "No se pudo procesar una imagen.");
    }
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
    const sourceVariant = activeVariant;
    const id = `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const variant: ProductVariant = {
      ...(sourceVariant ?? {}),
      id,
      name: variantNameDraft.trim(),
      price: sourceVariant?.price ?? productForm.price,
      priceCurrency: sourceVariant?.priceCurrency ?? productForm.priceCurrency,
      comision: sourceVariant?.comision ?? productForm.comision,
      comisionCurrency: sourceVariant?.comisionCurrency ?? productForm.comisionCurrency,
      gastos: sourceVariant?.gastos ?? productForm.gastos,
      gastosCurrency: sourceVariant?.gastosCurrency ?? productForm.gastosCurrency,
      description: sourceVariant?.description ?? productForm.description,
      stock: sourceVariant?.stock ?? productForm.stock,
      stockUnlimited: sourceVariant?.stockUnlimited ?? productForm.stockUnlimited,
      features: [...(sourceVariant?.features ?? productForm.features)],
      includes: [...(sourceVariant?.includes ?? productForm.includes ?? [])],
      deliveryUnit:
        (sourceVariant?.deliveryUnit ?? productForm.deliveryUnit) === ""
          ? undefined
          : (sourceVariant?.deliveryUnit ?? productForm.deliveryUnit) || undefined,
      deliveryAmount: sourceVariant?.deliveryAmount ?? productForm.deliveryAmount,
      discount: sourceVariant?.discount ?? productForm.discount,
      supplier: sourceVariant?.supplier
        ? { ...sourceVariant.supplier }
        : productForm.supplier
          ? { ...productForm.supplier }
          : undefined,
    };
    setProductForm({ ...productForm, variants: [...productForm.variants, variant] });
    setSelectedVariantId(id);
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

  const searchPerfumeNotesWithAI = async () => {
    if (!productForm?.name.trim()) {
      setPerfumeNotesError("Completá el nombre del producto antes de buscar.");
      return;
    }
    setIsSearchingPerfumeNotes(true);
    setPerfumeNotesError("");
    setPerfumeNotesResult(null);
    try {
      const result = await importPerfumeNotesWithAI({
        data: { productName: productForm.name },
      });
      setPerfumeNotesResult(result);
      if (!result.matched) {
        setPerfumeNotesError(result.reason || "No se pudo confirmar que las notas correspondan a este perfume.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo importar la descripción.";
      setPerfumeNotesError(message);
    } finally {
      setIsSearchingPerfumeNotes(false);
    }
  };

  const applyPerfumeDescription = (description: string) => {
    setDescriptionDraft(description);
    updateActiveVariant({ description });
    setPerfumeNotesDialogOpen(false);
    toast.success("Notas importadas a la descripción");
  };

  if (!productForm) return null;

  const canApplyDescription =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    descriptionDraft !== descriptionAppliedRef.current;
  const canApplyFeatures =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    JSON.stringify(activeFeatures) !== featuresAppliedRef.current;
  const canApplyIncludes =
    Boolean(activeVariant) &&
    productForm.variants.length >= 2 &&
    JSON.stringify(activeIncludes) !== includesAppliedRef.current;

  const isNewProduct = mode === "create";
  const canSave = isNewProduct || hasChanges;
  const modeTitle = isNewProduct ? "Nuevo producto" : "Editar producto";
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
  const selectedCategory = availableCategories.find(
    (category) => category.slug === productForm.category,
  );
  const productSkuOptions = brands[safeBrandForForm as BrandSlug].productSkus ?? [];
  const activeSkuCode = activeVariant?.code ?? productForm.code;
  const currentSkuIsConfigured = productSkuOptions.some((sku) => sku.code === activeSkuCode);
  const getFormSubcategoryOptions = (level: number) =>
    getSubcategoryOptionsAtLevel(
      selectedCategory?.subcategories,
      productForm.subcategoryPath,
      level,
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
  const comisionValue = productForm.comision === 0 ? "" : String(productForm.comision);
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
  const hasBulkSkip = canSkipBulkEdit;
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
        tabIndex={-1}
        className="top-[5dvh] box-border grid h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] w-[calc(100vw-1rem)] max-w-5xl max-h-[90dvh] min-w-0 min-h-0 translate-y-0 touch-pan-y overscroll-y-contain overflow-x-hidden overflow-y-hidden rounded-3xl border border-border/60 bg-background p-3 pr-2 shadow-2xl &>*:min-w-0 md:scrollbar-width:thin md:[&::-webkit-scrollbar]:block md:[&::-webkit-scrollbar]:w-2 md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/40 sm:top-[50%] sm:h-[90dvh] sm:w-[calc(100vw-2rem)] sm:max-h-[calc(100vh-4rem)] sm:translate-y-[-50%] sm:overflow-hidden sm:p-6"
        style={{ scrollbarGutter: "stable" }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const dialogElement = event.currentTarget as HTMLElement;
          requestAnimationFrame(() => dialogElement.focus({ preventScroll: true }));
        }}
      >
        <DialogHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-10 sm:pr-12">
            <DialogTitle>{modeTitle}</DialogTitle>
            {hasBulkSkip ? (
              <div className="flex max-w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
        </DialogHeader>

        <div className="scrollbar-gutter-stable flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto overscroll-y-contain [&_input]:min-w-0 [&_textarea]:min-w-0 max-md:touch-pan-y">
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
                      subcategoryPath: [],
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
                      subcategoryPath: [],
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

              {productForm.category
                ? Array.from({ length: productForm.subcategoryPath.length + 1 }, (_, level) => {
                    const options = getFormSubcategoryOptions(level);
                    if (!options.length) return null;
                    return (
                      <div key={`subcategory-level-${level}`} className="space-y-2">
                        <Label htmlFor={`new-subcategory-${level}`}>
                          {level === 0 ? "Subcategoría" : `Subcategoría ${level + 1}`}
                        </Label>
                        <Select
                          value={productForm.subcategoryPath[level] ?? "none"}
                          onValueChange={(value) => {
                            const nextPath = productForm.subcategoryPath.slice(0, level);
                            if (value !== "none") nextPath.push(value);
                            setProductForm({
                              ...productForm,
                              subcategory: nextPath[0] ?? "",
                              subcategoryPath: nextPath,
                            });
                          }}
                        >
                          <SelectTrigger id={`new-subcategory-${level}`} className="w-full">
                            <SelectValue placeholder={`Seleccionar subcategoría ${level + 1}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin subcategoría</SelectItem>
                            {options.map((subcategory) => (
                              <SelectItem key={subcategory.slug} value={subcategory.slug}>
                                {subcategory.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })
                : null}

              <div className="grid gap-4 sm:col-span-4 sm:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="new-product-code">
                    {activeVariant ? "SKU de variante" : "SKU"}
                  </Label>
                  <Select
                    value={activeSkuCode || "none"}
                    onValueChange={(value) => {
                      const code = value === "none" ? undefined : value;
                      if (activeVariant) updateActiveVariant({ code });
                      else setProductForm({ ...productForm, code: code ?? "" });
                    }}
                  >
                    <SelectTrigger id="new-product-code" className="w-full">
                      <SelectValue placeholder="Seleccionar SKU" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin SKU</SelectItem>
                      {activeSkuCode && !currentSkuIsConfigured ? (
                        <SelectItem value={activeSkuCode}>
                          {activeSkuCode} (SKU actual)
                        </SelectItem>
                      ) : null}
                      {productSkuOptions.map((sku) => (
                        <SelectItem key={sku.id} value={sku.code}>
                          {sku.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

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
                      onValueChange={(value) => {
                        const deliveryUnit = value as DeliveryUnit;
                        setProductForm({
                          ...productForm,
                          deliveryUnit,
                          deliveryAmount:
                            deliveryUnit === "inmediata"
                              ? 0
                              : Math.max(productForm.deliveryAmount, 1),
                        });
                      }}
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
                  value={activeCommission === 0 ? "" : activeCommission}
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
                    onValueChange={(value) => {
                      const deliveryUnit = value as DeliveryUnit;
                      updateActiveVariant({
                        deliveryUnit,
                        deliveryAmount:
                          deliveryUnit === "inmediata" ? 0 : Math.max(activeDeliveryAmount, 1),
                      });
                    }}
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
                      className="flex items-center justify-between gap-2 rounded-xl border border-input p-3 max-md:flex-col max-md:items-stretch"
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
                          <div className="flex shrink-0 items-center justify-end gap-1 max-md:w-full max-md:flex-nowrap max-md:border-t max-md:border-border/50 max-md:pt-2">
                            <Button
                              type="button"
                              variant={selectedVariantId === variant.id ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => setSelectedVariantId(variant.id)}
                              className="h-7 shrink-0 gap-1 px-1.5 text-[10px] whitespace-nowrap sm:h-8 sm:gap-2 sm:px-3 sm:text-sm"
                              disabled={selectedVariantId === variant.id}
                            >
                              {selectedVariantId === variant.id ? "Seleccionado" : "Seleccionar"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartVariantEdit(index)}
                              className="h-7 shrink-0 gap-1 px-1.5 text-[10px] whitespace-nowrap sm:h-8 sm:gap-2 sm:px-3 sm:text-sm"
                            >
                              <Pencil className="size-3.5 sm:size-4" /> Editar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeVariant(index)}
                              className="h-7 shrink-0 gap-1 px-1.5 text-[10px] whitespace-nowrap text-destructive hover:bg-destructive/10 sm:h-8 sm:gap-2 sm:px-3 sm:text-sm"
                            >
                              <Trash2 className="size-3.5 sm:size-4" /> Eliminar
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
                <div className="space-y-2">
                  <Label htmlFor="product-supplier-references">Referencias</Label>
                  <Input
                    id="product-supplier-references"
                    value={newSupplier.references ?? ""}
                    onChange={(event) =>
                      setNewSupplier((current) => ({
                        ...current,
                        references: event.target.value,
                      }))
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
                  <label className="inline-flex h-auto min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 sm:h-9 sm:w-auto sm:min-w-13rem sm:shrink-0 sm:whitespace-nowrap sm:py-1">
                    <span className="min-w-0 text-left text-[11px] leading-tight sm:text-sm sm:leading-none">
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
                <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Descripción
                </div>
                <div className="grid min-w-0 grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <Textarea
                    value={descriptionDraft}
                    rows={3}
                    className="min-h-90px w-full min-w-0"
                    onChange={(event) => {
                      const nextDescription = event.target.value;
                      setDescriptionDraft(nextDescription);
                      updateActiveVariant({ description: nextDescription });
                    }}
                    placeholder="Descripción de esta variante"
                  />
                  <div className="flex w-fit max-w-full flex-col items-start gap-2">
                    <label className="inline-flex h-10 w-fit max-w-full items-center justify-between gap-2 whitespace-nowrap rounded-2xl border border-border/60 bg-background/80 px-3 py-1">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-center"
                      onClick={() => {
                        setPerfumeNotesResult(null);
                        setPerfumeNotesError("");
                        setPerfumeNotesDialogOpen(true);
                      }}
                    >
                      <FileText className="size-4" /> Importar descripción
                    </Button>
                  </div>
                </div>
                <Dialog open={perfumeNotesDialogOpen} onOpenChange={setPerfumeNotesDialogOpen}>
                  <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                    <DialogHeader>
                      <DialogTitle>Importar notas del perfume</DialogTitle>
                      <DialogDescription>
                        La IA buscará “{productForm.name || "producto"}” en la web, sin consultar
                        Fragrantica. Revisá las notas y sus fuentes antes de aplicarlas.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Button
                        type="button"
                        onClick={() => void searchPerfumeNotesWithAI()}
                        disabled={isSearchingPerfumeNotes || !productForm.name.trim()}
                      >
                        {isSearchingPerfumeNotes ? (
                          <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                        {isSearchingPerfumeNotes ? "Buscando notas…" : "Buscar con IA"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Las notas generadas pueden contener errores. La búsqueda debe incluir
                        fuentes verificables y no aplica cambios hasta que las confirmes.
                      </p>
                      {perfumeNotesError ? (
                        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          {perfumeNotesError}
                        </p>
                      ) : null}
                      {perfumeNotesResult ? (
                        <article className="space-y-3 rounded-2xl border border-border/60 bg-surface/40 p-4">
                          <div>
                            <h3 className="font-medium">{perfumeNotesResult.title}</h3>
                            {perfumeNotesResult.matched ? (
                              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                                {perfumeNotesResult.description}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium">Fuentes consultadas</p>
                            {perfumeNotesResult.sources.map((source) => (
                              <a
                                key={source.url}
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block break-all text-xs text-primary underline-offset-4 hover:underline"
                              >
                                {source.title}
                              </a>
                            ))}
                          </div>
                          {perfumeNotesResult.matched ? (
                            <Button
                              type="button"
                              size="sm"
                              disabled={!activeVariant}
                              onClick={() => applyPerfumeDescription(perfumeNotesResult.description)}
                            >
                              Usar estas notas
                            </Button>
                          ) : null}
                        </article>
                      ) : null}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
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

        <DialogFooter className="flex-wrap items-center justify-between gap-2 max-md:w-full max-md:shrink-0 max-md:border-t max-md:border-border/60 max-md:pt-3">
          {hasBulkNavigation ? (
            <div className="mr-auto flex shrink-0 items-center gap-2 max-md:order-first max-md:w-full max-md:justify-start">
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
          <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:w-auto sm:flex sm:items-center sm:justify-end">
            {onDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={onDelete}
                disabled={isSaving}
                className="gap-2 max-md:col-start-1 max-md:row-start-1"
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
              className={cn(
                "rounded-md border border-transparent bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80 hover:text-secondary-foreground hover:shadow-none",
                hasBulkSkip
                  ? onDelete
                    ? "max-md:col-start-2 max-md:row-start-1"
                    : "max-md:col-start-1 max-md:row-start-1"
                  : onDelete
                    ? "max-md:col-start-1 max-md:row-start-2"
                    : "max-md:col-start-1 max-md:row-start-1",
              )}
              style={{ boxShadow: "none" }}
            >
              <X className="mr-2 size-4" /> Cancelar
            </Button>
            {hasBulkSkip ? (
              <Button
                type="button"
                variant="default"
                onClick={onSkipBulkEdit}
                disabled={isSaving}
                className={cn(
                  "bg-emerald-600 text-white hover:bg-emerald-700",
                  onDelete
                    ? "max-md:col-start-1 max-md:row-start-2"
                    : "max-md:col-start-2 max-md:row-start-1",
                )}
              >
                Saltar <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="default"
              disabled={!canSave || isSaving}
              onClick={() => void onSave()}
              className={cn(
                "rounded-md border border-transparent bg-primary text-primary-foreground shadow-none hover:bg-primary/90 hover:text-primary-foreground hover:shadow-none disabled:opacity-50",
                hasBulkSkip
                  ? onDelete
                    ? "max-md:col-start-2 max-md:row-start-2 max-md:w-full"
                    : "max-md:col-span-2 max-md:row-start-2 max-md:w-full"
                  : onDelete
                    ? "max-md:col-start-2 max-md:row-start-2"
                    : "max-md:col-start-2 max-md:row-start-1",
              )}
              style={{ boxShadow: "none" }}
            >
              <Save className="mr-2 size-4" />
              {isSaving
                ? "Guardando..."
                : isNewProduct
                  ? "Guardar producto"
                  : "Guardar cambios"}
            </Button>
          </div>

        </DialogFooter>
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
