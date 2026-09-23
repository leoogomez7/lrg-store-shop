import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  ContactRound,
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
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { FilterChipList, type FilterChipItem } from "@/components/product/product-filters";
import { saveAdminSetting } from "@/server/persistence";
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
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { catalogQueries, orderQueries } from "@/services/catalog.service";
import { formatNumber } from "@/lib/format";
import { saveProducts, type Product } from "@/data/products";
import { moveToTrash } from "@/data/trash";

export const Route = createFileRoute("/admin/proveedores")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(catalogQueries.all()),
      context.queryClient.ensureQueryData(catalogQueries.settings()),
    ]);
  },
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminSuppliers,
});

type SupplierRow = {
  key: string;
  name: string;
  phone: string;
  social: string;
  products: Array<{ name: string; quantity: number }>;
  stores: string[];
  sales: number;
  salesByCurrency: Record<"ARS" | "USD", number>;
  soldQuantity: number;
};

type StandaloneSupplier = Pick<SupplierRow, "name" | "phone" | "social">;

const SUPPLIERS_STORAGE_KEY = "lrg:suppliers";

function AdminSuppliers() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const { data: settings } = useSuspenseQuery(catalogQueries.settings());
  const { data: orders = [] } = useQuery(orderQueries.list());
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState("");
  const [sortOrder, setSortOrder] = React.useState<
    "name_asc" | "name_desc" | "quantity_asc" | "quantity_desc" | "sales_asc" | "sales_desc"
  >("name_asc");
  const [storeFilter, setStoreFilter] = React.useState<string[]>([]);
  const [currencyFilter, setCurrencyFilter] = React.useState<Array<"ARS" | "USD">>(["ARS", "USD"]);
  const [salesMin, setSalesMin] = React.useState(0);
  const [salesMax, setSalesMax] = React.useState(0);
  const [quantityMin, setQuantityMin] = React.useState(0);
  const [quantityMax, setQuantityMax] = React.useState(0);
  const [sortOpen, setSortOpen] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [storeOpen, setStoreOpen] = React.useState(false);
  const [salesOpen, setSalesOpen] = React.useState(false);
  const [quantityOpen, setQuantityOpen] = React.useState(false);
  const [expandedSupplierKey, setExpandedSupplierKey] = React.useState<string | null>(null);
  const hasExpandedSupplier = expandedSupplierKey !== null;
  const [productsModalSupplier, setProductsModalSupplier] = React.useState<SupplierRow | null>(
    null,
  );
  const [standaloneSuppliers, setStandaloneSuppliers] = React.useState<StandaloneSupplier[]>([]);

  React.useEffect(() => {
    const stored = settings.find((setting) => setting.settingKey === SUPPLIERS_STORAGE_KEY);
    if (!stored) {
      setStandaloneSuppliers([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored.settingValue) as unknown;
      setStandaloneSuppliers(Array.isArray(parsed) ? (parsed as StandaloneSupplier[]) : []);
    } catch {
      setStandaloneSuppliers([]);
    }
  }, [settings]);

  const [newSupplierOpen, setNewSupplierOpen] = React.useState(false);
  const [newSupplier, setNewSupplier] = React.useState<StandaloneSupplier>({
    name: "",
    phone: "",
    social: "",
  });
  const [page, setPage] = React.useState(0);
  const [pageSize, setPageSize] = React.useState(10);
  const [pageSizeInput, setPageSizeInput] = React.useState("10");
  const [selectedSupplierKeys, setSelectedSupplierKeys] = React.useState<string[]>([]);
  const [bulkSupplierEditQueue, setBulkSupplierEditQueue] = React.useState<string[]>([]);
  const [bulkSupplierEditPosition, setBulkSupplierEditPosition] = React.useState(0);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [quickEditSupplierKey, setQuickEditSupplierKey] = React.useState<string | null>(null);
  const [quickEditSupplier, setQuickEditSupplier] = React.useState<StandaloneSupplier | null>(null);
  const [quickEditFromDetails, setQuickEditFromDetails] = React.useState(false);
  const [quickEditSupplierQueue, setQuickEditSupplierQueue] = React.useState<string[]>([]);
  const [editingSupplierKey, setEditingSupplierKey] = React.useState<string | null>(null);
  const supplierFormKey = `${newSupplier.name.trim()}|${newSupplier.phone.trim()}|${newSupplier.social.trim()}`;
  const supplierFormHasChanges = !editingSupplierKey || supplierFormKey !== editingSupplierKey;

  const toggleSupplierSelection = (key: string, checked: boolean) => {
    setSelectedSupplierKeys((current) =>
      checked ? [...new Set([...current, key])] : current.filter((item) => item !== key),
    );
  };

  const rows = React.useMemo<SupplierRow[]>(() => {
    const grouped = new Map<string, SupplierRow>();
    for (const product of products) {
      const assignments = product.variants?.length
        ? product.variants.map((variant) => ({
            supplier: variant.supplier ?? product.supplier,
            productId: product.id,
            variantId: variant.id,
            productName: `${product.name} · ${variant.name}`,
            variantName: variant.name,
            gastos: variant.gastos ?? product.gastos ?? 0,
            gastosCurrency:
              variant.gastosCurrency ??
              product.gastosCurrency ??
              variant.priceCurrency ??
              product.priceCurrency ??
              "ARS",
          }))
        : [
            {
              supplier: product.supplier,
              productId: product.id,
              variantId: undefined,
              productName: product.name,
              variantName: product.name,
              gastos: product.gastos ?? 0,
              gastosCurrency: product.gastosCurrency ?? product.priceCurrency ?? "ARS",
            },
          ];
      for (const assignment of assignments) {
        const supplier = assignment.supplier;
        const name = supplier?.name ?? "";
        const phone = supplier?.phone ?? "";
        const social = supplier?.social ?? "";
        if (!name && !phone && !social) continue;
        const key = `${name}|${phone}|${social}`;
        const assignmentSummary = orders.reduce(
          (summary, order) => {
            for (const item of order.items) {
              if (item.supplier) continue;
              const itemName = item.name.toLowerCase();
              const itemVariantName = item.variantName?.toLowerCase();
              const matchesById =
                item.productId === assignment.productId && item.variantId === assignment.variantId;
              const matchesLegacy =
                !item.productId &&
                (itemName === assignment.productName.toLowerCase() ||
                  itemVariantName === assignment.variantName.toLowerCase() ||
                  (!product.variants?.length && itemName === product.name.toLowerCase()));
              if (!matchesById && !matchesLegacy) continue;

              const itemGastos = item.gastos ?? assignment.gastos;
              const itemCurrency = item.gastosCurrency ?? assignment.gastosCurrency;
              summary.total += itemGastos * item.quantity;
              summary.byCurrency[itemCurrency] += itemGastos * item.quantity;
              summary.quantity += item.quantity;
            }
            return summary;
          },
          { total: 0, byCurrency: { ARS: 0, USD: 0 }, quantity: 0 },
        );
        const current = grouped.get(key) ?? {
          key,
          name,
          phone,
          social,
          products: [],
          stores: [],
          sales: 0,
          salesByCurrency: { ARS: 0, USD: 0 },
          soldQuantity: 0,
        };
        if (assignmentSummary.quantity > 0) {
          const currentProduct = current.products.find(
            (item) => item.name === assignment.productName,
          );
          if (currentProduct) {
            currentProduct.quantity += assignmentSummary.quantity;
          } else {
            current.products.push({
              name: assignment.productName,
              quantity: assignmentSummary.quantity,
            });
          }
        }
        if (!current.stores.includes(product.brand)) current.stores.push(product.brand);
        current.sales += assignmentSummary.total;
        current.salesByCurrency.ARS += assignmentSummary.byCurrency.ARS;
        current.salesByCurrency.USD += assignmentSummary.byCurrency.USD;
        current.soldQuantity += assignmentSummary.quantity;
        grouped.set(key, current);
      }
    }

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.supplier || item.quantity <= 0) continue;
        const { name, phone, social } = item.supplier;
        if (!name && !phone && !social) continue;
        const key = `${name}|${phone}|${social}`;
        const current = grouped.get(key) ?? {
          key,
          name,
          phone,
          social,
          products: [],
          stores: [],
          sales: 0,
          salesByCurrency: { ARS: 0, USD: 0 },
          soldQuantity: 0,
        };
        const productName = item.variantName ? `${item.name} · ${item.variantName}` : item.name;
        const currentProduct = current.products.find((product) => product.name === productName);
        if (currentProduct) {
          currentProduct.quantity += item.quantity;
        } else {
          current.products.push({ name: productName, quantity: item.quantity });
        }
        const itemGastos = item.gastos ?? 0;
        const itemCurrency = item.gastosCurrency ?? "ARS";
        const itemSales = itemGastos * item.quantity;
        current.sales += itemSales;
        current.salesByCurrency[itemCurrency] += itemSales;
        current.soldQuantity += item.quantity;
        const itemStore = item.brand ?? order.brand;
        if (!current.stores.includes(itemStore)) current.stores.push(itemStore);
        grouped.set(key, current);
      }
    }

    for (const supplier of standaloneSuppliers) {
      const key = `${supplier.name}|${supplier.phone}|${supplier.social}`;
      if (!grouped.has(key))
        grouped.set(key, {
          key,
          ...supplier,
          products: [],
          stores: [],
          sales: 0,
          salesByCurrency: { ARS: 0, USD: 0 },
          soldQuantity: 0,
        });
    }
    return Array.from(grouped.values());
  }, [orders, products, standaloneSuppliers]);

  const storeOptions = [
    ["arcade", "LRG Arcade"],
    ["scents", "LRG Scents"],
    ["web-design", "LRG Web Design"],
  ] as const;
  const sortOptions = [
    ["name_asc", "Proveedor: A-Z"],
    ["name_desc", "Proveedor: Z-A"],
    ["quantity_asc", "Cantidad vendida: menor a mayor"],
    ["quantity_desc", "Cantidad vendida: mayor a menor"],
    ["sales_asc", "Vendido: menor a mayor"],
    ["sales_desc", "Vendido: mayor a menor"],
  ] as const;
  const salesLimit = Math.max(
    1,
    ...rows.map((row) =>
      currencyFilter.reduce((sum, currency) => sum + row.salesByCurrency[currency], 0),
    ),
  );
  const quantityLimit = Math.max(1, ...rows.map((row) => row.soldQuantity));
  const effectiveSalesMax = salesMax || salesLimit;
  const effectiveQuantityMax = quantityMax || quantityLimit;

  React.useEffect(() => {
    setSalesMax(salesLimit);
    setQuantityMax(quantityLimit);
  }, [salesLimit, quantityLimit]);

  const closeSupplierEditor = () => {
    setNewSupplierOpen(false);
    setEditingSupplierKey(null);
    setBulkSupplierEditQueue([]);
    setBulkSupplierEditPosition(0);
    setSelectedSupplierKeys([]);
    setSelectionMode(false);
  };

  const addSupplier = () => {
    const supplier = {
      name: newSupplier.name.trim(),
      phone: newSupplier.phone.trim(),
      social: newSupplier.social.trim(),
    };
    if (!supplier.name || !supplier.phone || !supplier.social) return;
    if (editingSupplierKey) {
      saveSupplierChanges(editingSupplierKey, supplier, bulkSupplierEditQueue.length === 0);
      const nextPosition = bulkSupplierEditPosition + 1;
      const nextKey = bulkSupplierEditQueue[nextPosition];
      const nextRow =
        filteredRows.find((row) => row.key === nextKey) ?? rows.find((row) => row.key === nextKey);
      if (nextRow) {
        setBulkSupplierEditPosition(nextPosition);
        openSupplierEditor(nextRow);
        return;
      }
      closeSupplierEditor();
      return;
    }
    const nextSuppliers = [...standaloneSuppliers, supplier];
    setStandaloneSuppliers(nextSuppliers);
    void saveAdminSetting({
      data: { settingKey: SUPPLIERS_STORAGE_KEY, settingValue: JSON.stringify(nextSuppliers) },
    });
    setNewSupplier({ name: "", phone: "", social: "" });
    setNewSupplierOpen(false);
  };

  const openSupplierEditor = (row: SupplierRow) => {
    setEditingSupplierKey(row.key);
    setNewSupplier({ name: row.name, phone: row.phone, social: row.social });
    setNewSupplierOpen(true);
  };

  const startQuickEditSupplier = (row: SupplierRow, fromDetails = false) => {
    setExpandedSupplierKey(fromDetails ? row.key : null);
    setQuickEditSupplierKey(row.key);
    setQuickEditSupplier({ name: row.name, phone: row.phone, social: row.social });
    setQuickEditFromDetails(fromDetails);
  };

  const startBulkQuickEditSuppliers = () => {
    const queue = selectedSupplierKeys
      .map((key) => rows.find((row) => row.key === key))
      .filter((row): row is SupplierRow => Boolean(row));
    const firstRow = queue[0];
    if (!firstRow) return;
    setQuickEditSupplierQueue(queue.slice(1).map((row) => row.key));
    startQuickEditSupplier(firstRow);
  };

  const cancelQuickEditSupplier = () => {
    setQuickEditSupplierKey(null);
    setQuickEditSupplier(null);
    setQuickEditFromDetails(false);
    setQuickEditSupplierQueue([]);
  };

  const saveSupplierChanges = (
    supplierKey: string,
    nextSupplier: StandaloneSupplier,
    closeEditor = true,
  ) => {
    const normalized = {
      name: nextSupplier.name.trim(),
      phone: nextSupplier.phone.trim(),
      social: nextSupplier.social.trim(),
    };
    if (!normalized.name || !normalized.phone || !normalized.social) return;

    const nextStandaloneSuppliers = standaloneSuppliers.map((supplier) =>
      `${supplier.name}|${supplier.phone}|${supplier.social}` === supplierKey
        ? normalized
        : supplier,
    );
    const nextProducts = (products as Product[]).map((product) => ({
      ...product,
      ...(product.supplier ? { supplier: product.supplier } : {}),
      ...(product.variants
        ? {
            variants: product.variants.map((variant) => ({
              ...variant,
              ...(variant.supplier ? { supplier: variant.supplier } : {}),
              ...(variant.supplier &&
              `${variant.supplier.name}|${variant.supplier.phone}|${variant.supplier.social}` ===
                supplierKey
                ? { supplier: { ...normalized, purchaseDate: variant.supplier.purchaseDate } }
                : {}),
            })),
          }
        : {}),
    }));
    for (const product of nextProducts) {
      if (
        product.supplier &&
        `${product.supplier.name}|${product.supplier.phone}|${product.supplier.social}` ===
          supplierKey
      ) {
        product.supplier = { ...normalized, purchaseDate: product.supplier.purchaseDate };
      }
    }

    setStandaloneSuppliers(nextStandaloneSuppliers);
    void saveAdminSetting({
      data: {
        settingKey: SUPPLIERS_STORAGE_KEY,
        settingValue: JSON.stringify(nextStandaloneSuppliers),
      },
    });
    saveProducts(nextProducts);
    queryClient.setQueryData(catalogQueries.all().queryKey, nextProducts);
    setQuickEditSupplierKey(null);
    setQuickEditSupplier(null);
    setQuickEditFromDetails(false);
    const nextQuickEditKey = quickEditSupplierQueue[0];
    if (closeEditor && nextQuickEditKey) {
      setQuickEditSupplierQueue((current) => current.slice(1));
      const nextRow = rows.find((row) => row.key === nextQuickEditKey);
      if (nextRow) startQuickEditSupplier(nextRow);
    }
    toast.success("Proveedor guardado");
    if (closeEditor) setEditingSupplierKey(null);
  };

  const deleteSupplier = (supplierKey: string) => {
    const supplierRow = rows.find((row) => row.key === supplierKey);
    if (supplierRow) {
      moveToTrash({
        type: "proveedor",
        id: supplierKey,
        item: {
          name: supplierRow.name,
          phone: supplierRow.phone,
          social: supplierRow.social,
        },
      });
    }
    const nextStandaloneSuppliers = standaloneSuppliers.filter(
      (supplier) => `${supplier.name}|${supplier.phone}|${supplier.social}` !== supplierKey,
    );
    const nextProducts = (products as Product[]).map((product) => ({
      ...product,
      ...(product.supplier &&
      `${product.supplier.name}|${product.supplier.phone}|${product.supplier.social}` ===
        supplierKey
        ? {}
        : product.supplier
          ? { supplier: product.supplier }
          : {}),
      ...(product.variants
        ? {
            variants: product.variants.map((variant) => ({
              ...variant,
              ...(variant.supplier &&
              `${variant.supplier.name}|${variant.supplier.phone}|${variant.supplier.social}` ===
                supplierKey
                ? {}
                : variant.supplier
                  ? { supplier: variant.supplier }
                  : {}),
            })),
          }
        : {}),
    }));

    setStandaloneSuppliers(nextStandaloneSuppliers);
    setSelectedSupplierKeys((current) => current.filter((key) => key !== supplierKey));
    void saveAdminSetting({
      data: {
        settingKey: SUPPLIERS_STORAGE_KEY,
        settingValue: JSON.stringify(nextStandaloneSuppliers),
      },
    });
    saveProducts(nextProducts);
    queryClient.setQueryData(catalogQueries.all().queryKey, nextProducts);
  };

  const editSelectedSupplier = () => {
    const selectedRow = filteredRows.find((row) => selectedSupplierKeys.includes(row.key));
    if (selectedRow) {
      const selectedKeys = new Set(selectedSupplierKeys);
      const queue = filteredRows.filter((row) => selectedKeys.has(row.key)).map((row) => row.key);
      setBulkSupplierEditQueue(queue);
      setBulkSupplierEditPosition(0);
      openSupplierEditor(selectedRow);
    }
  };

  const navigateBulkEditSupplier = (direction: -1 | 1) => {
    const nextPosition = bulkSupplierEditPosition + direction;
    const nextRow = filteredRows.find((row) => row.key === bulkSupplierEditQueue[nextPosition]);
    if (!nextRow) return;
    setBulkSupplierEditPosition(nextPosition);
    openSupplierEditor(nextRow);
  };

  const deleteSelectedSuppliers = () => {
    const selectedKeys = new Set(selectedSupplierKeys);
    filteredRows
      .filter((row) => selectedKeys.has(row.key))
      .forEach((row) =>
        moveToTrash({
          type: "proveedor",
          id: row.key,
          item: { name: row.name, phone: row.phone, social: row.social },
        }),
      );
    const nextStandaloneSuppliers = standaloneSuppliers.filter(
      (supplier) => !selectedKeys.has(`${supplier.name}|${supplier.phone}|${supplier.social}`),
    );
    const nextProducts = (products as Product[]).map((product) => ({
      ...product,
      ...(product.supplier &&
      selectedKeys.has(
        `${product.supplier.name}|${product.supplier.phone}|${product.supplier.social}`,
      )
        ? {}
        : product.supplier
          ? { supplier: product.supplier }
          : {}),
      ...(product.variants
        ? {
            variants: product.variants.map((variant) => ({
              ...variant,
              ...(variant.supplier &&
              selectedKeys.has(
                `${variant.supplier.name}|${variant.supplier.phone}|${variant.supplier.social}`,
              )
                ? {}
                : variant.supplier
                  ? { supplier: variant.supplier }
                  : {}),
            })),
          }
        : {}),
    }));

    setStandaloneSuppliers(nextStandaloneSuppliers);
    setSelectedSupplierKeys([]);
    void saveAdminSetting({
      data: {
        settingKey: SUPPLIERS_STORAGE_KEY,
        settingValue: JSON.stringify(nextStandaloneSuppliers),
      },
    });
    saveProducts(nextProducts);
    queryClient.setQueryData(catalogQueries.all().queryKey, nextProducts);
  };

  const filteredRows = rows
    .filter((row) => {
      const selectedSales = currencyFilter.reduce(
        (sum, currency) => sum + row.salesByCurrency[currency],
        0,
      );
      return (
        [row.name, row.phone, row.social, ...row.products].some((value) =>
          value.toLowerCase().includes(query.toLowerCase()),
        ) &&
        (!storeFilter.length || row.stores.some((store) => storeFilter.includes(store))) &&
        selectedSales >= salesMin &&
        selectedSales <= effectiveSalesMax &&
        row.soldQuantity >= quantityMin &&
        row.soldQuantity <= effectiveQuantityMax
      );
    })
    .sort((a, b) => {
      const aSales = currencyFilter.reduce((sum, currency) => sum + a.salesByCurrency[currency], 0);
      const bSales = currencyFilter.reduce((sum, currency) => sum + b.salesByCurrency[currency], 0);
      switch (sortOrder) {
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "quantity_asc":
          return a.soldQuantity - b.soldQuantity;
        case "quantity_desc":
          return b.soldQuantity - a.soldQuantity;
        case "sales_asc":
          return aSales - bSales;
        case "sales_desc":
          return bSales - aSales;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  const activeFilterCount =
    storeFilter.length +
    (currencyFilter.length === 1 ? 1 : 0) +
    (salesMin > 0 ? 1 : 0) +
    (effectiveSalesMax < salesLimit ? 1 : 0) +
    (quantityMin > 0 ? 1 : 0) +
    (effectiveQuantityMax < quantityLimit ? 1 : 0);
  const resetFilters = () => {
    setStoreFilter([]);
    setCurrencyFilter(["ARS", "USD"]);
    setSalesMin(0);
    setSalesMax(salesLimit);
    setQuantityMin(0);
    setQuantityMax(quantityLimit);
  };
  const toggleFilterSelection = (
    selected: string[],
    value: string,
    checked: boolean,
    options: string[],
  ) => {
    if (value === "all") return [];
    const next = checked
      ? Array.from(new Set([...selected, value]))
      : selected.filter((item) => item !== value);
    return options.every((option) => next.includes(option)) ? [] : next;
  };
  const filterChips: FilterChipItem[] = [
    ...(query ? [{ key: "search", label: `Buscar: ${query}`, onRemove: () => setQuery("") }] : []),
    ...storeFilter.map((store) => ({
      key: `store-${store}`,
      label: storeOptions.find(([value]) => value === store)?.[1] ?? store,
      onRemove: () => setStoreFilter((current) => current.filter((item) => item !== store)),
    })),
    ...(currencyFilter.length === 1
      ? [
          {
            key: "currency",
            label: currencyFilter[0] === "ARS" ? "$ (ARS)" : "USD (Dólar)",
            onRemove: () => setCurrencyFilter(["ARS", "USD"]),
          },
        ]
      : []),
    ...(salesMin > 0
      ? [{ key: "sales-min", label: `Vendido desde ${salesMin}`, onRemove: () => setSalesMin(0) }]
      : []),
    ...(effectiveSalesMax < salesLimit
      ? [
          {
            key: "sales-max",
            label: `Vendido hasta ${effectiveSalesMax}`,
            onRemove: () => setSalesMax(salesLimit),
          },
        ]
      : []),
    ...(quantityMin > 0
      ? [
          {
            key: "quantity-min",
            label: `Cantidad desde ${quantityMin}`,
            onRemove: () => setQuantityMin(0),
          },
        ]
      : []),
    ...(effectiveQuantityMax < quantityLimit
      ? [
          {
            key: "quantity-max",
            label: `Cantidad hasta ${effectiveQuantityMax}`,
            onRemove: () => setQuantityMax(quantityLimit),
          },
        ]
      : []),
  ];
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice(page * pageSize, page * pageSize + pageSize);
  const visibleSupplierKeys = visibleRows.map((row) => row.key);
  const allVisibleSuppliersSelected =
    visibleSupplierKeys.length > 0 &&
    visibleSupplierKeys.every((key) => selectedSupplierKeys.includes(key));
  const someVisibleSuppliersSelected = visibleSupplierKeys.some((key) =>
    selectedSupplierKeys.includes(key),
  );
  const hasPreviousPage = page > 0;
  const hasNextPage = page + 1 < totalPages;

  React.useEffect(() => {
    setPage(0);
  }, [query, sortOrder, storeFilter, currencyFilter, salesMin, salesMax, quantityMin, quantityMax]);

  const exportRows = filteredRows.map((row) => [
    row.name,
    row.phone,
    row.social,
    row.products.map((product) => `${product.name} (${product.quantity})`).join(", "),
    row.sales,
    row.soldQuantity,
  ]);
  const exportExcel = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Nombre", "Celular", "Red social", "Productos", "Total vendido ($/USD)", "Cantidad vendida"],
      ...exportRows,
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Proveedores");
    XLSX.writeFile(workbook, "proveedores.xlsx");
  };
  const exportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d4d4d4;padding:8px;text-align:left}th{background:#f3f3f3}</style></head><body><h2>Proveedores</h2><table border="1" cellpadding="6"><thead><tr><th>Nombre</th><th>Celular</th><th>Red social</th><th>Productos</th><th>Total vendido</th><th>Cantidad vendida</th></tr></thead><tbody>${exportRows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`,
    );
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="w-full">
        <div className="flex flex-wrap items-center gap-2">
          <div className="order-1 basis-full shrink-0">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Listado</p>
            <h1 className="mt-2 text-3xl font-semibold">Proveedores</h1>
          </div>
          <div className="order-2 relative min-w-0 basis-full flex-1 sm:basis-auto">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar proveedor"
              className="h-9 w-full pl-9"
            />
          </div>
          <Button
            onClick={() => {
              setEditingSupplierKey(null);
              setBulkSupplierEditQueue([]);
              setBulkSupplierEditPosition(0);
              setNewSupplier({ name: "", phone: "", social: "" });
              setNewSupplierOpen(true);
            }}
            className="order-2 h-9 basis-full sm:basis-auto"
          >
            <Plus className="size-4" />
            Nuevo proveedor
          </Button>
          <div className="order-3 flex basis-full flex-col gap-2 sm:basis-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 sm:shrink-0">
            <Dialog open={sortOpen} onOpenChange={setSortOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5">
                  <ArrowUpDown className="size-4" /> Ordenar por
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Ordenar por</DialogTitle>
                </DialogHeader>
                <div className="space-y-1 pt-2">
                  {sortOptions.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSortOrder(value);
                        setSortOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 ${sortOrder === value ? "bg-surface-2 text-foreground" : "text-muted-foreground"}`}
                    >
                      <span>{label}</span>
                      {sortOrder === value && <Check className="size-4" />}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
              <DialogContent className="max-h-[min(92vh,48rem)] max-w-2xl overflow-y-auto rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                <DialogHeader>
                  <DialogTitle>Filtros</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setStoreOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={storeOpen}
                    >
                      <span>Productos en tiendas</span>
                      {storeFilter.length > 0 && (
                        <Badge variant="secondary">{storeFilter.length}</Badge>
                      )}
                      {storeOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    {storeOpen && (
                      <div className="space-y-2.5">
                        {[["all", "Todos"] as const, ...storeOptions].map(([value, label]) => (
                          <label
                            key={value}
                            className="flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <Checkbox
                              checked={
                                value === "all"
                                  ? storeFilter.length === 0
                                  : storeFilter.includes(value)
                              }
                              onCheckedChange={(checked) =>
                                setStoreFilter((current) =>
                                  toggleFilterSelection(
                                    current,
                                    value,
                                    checked === true,
                                    storeOptions.map(([option]) => option),
                                  ),
                                )
                              }
                            />
                            <span className="font-medium">{label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSalesOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={salesOpen}
                    >
                      <span>Total vendido</span>
                      {salesOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    {salesOpen && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-4">
                          {(["ARS", "USD"] as const).map((currency) => (
                            <label key={currency} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={currencyFilter.includes(currency)}
                                onCheckedChange={(checked) =>
                                  setCurrencyFilter((current) =>
                                    checked
                                      ? Array.from(new Set([...current, currency]))
                                      : current.length === 1
                                        ? current
                                        : current.filter((item) => item !== currency),
                                  )
                                }
                              />
                              <span>{currency === "ARS" ? "$ (ARS)" : "USD (Dólar)"}</span>
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-3 text-xs font-medium">
                          <label className="flex items-center gap-2">
                            Desde{" "}
                            <Input
                              type="number"
                              min={0}
                              max={salesMax}
                              value={salesMin}
                              onChange={(event) =>
                                setSalesMin(
                                  Math.min(Math.max(0, Number(event.target.value) || 0), salesMax),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            Hasta{" "}
                            <Input
                              type="number"
                              min={0}
                              max={salesLimit}
                              value={salesMax}
                              onChange={(event) =>
                                setSalesMax(
                                  Math.max(
                                    Math.min(salesLimit, Number(event.target.value) || 0),
                                    salesMin,
                                  ),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                        </div>
                        <Slider
                          min={0}
                          max={salesLimit}
                          step={Math.max(1, Math.round(salesLimit / 100))}
                          value={[salesMin, salesMax]}
                          onValueChange={(value) => {
                            setSalesMin(value[0] ?? 0);
                            setSalesMax(value[1] ?? salesLimit);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setQuantityOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={quantityOpen}
                    >
                      <span>Total de cantidad vendida</span>
                      {quantityOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    {quantityOpen && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 text-xs font-medium">
                          <label className="flex items-center gap-2">
                            Desde{" "}
                            <Input
                              type="number"
                              min={0}
                              max={quantityMax}
                              value={quantityMin}
                              onChange={(event) =>
                                setQuantityMin(
                                  Math.min(
                                    Math.max(0, Number(event.target.value) || 0),
                                    quantityMax,
                                  ),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            Hasta{" "}
                            <Input
                              type="number"
                              min={0}
                              max={quantityLimit}
                              value={quantityMax}
                              onChange={(event) =>
                                setQuantityMax(
                                  Math.max(
                                    Math.min(quantityLimit, Number(event.target.value) || 0),
                                    quantityMin,
                                  ),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                        </div>
                        <Slider
                          min={0}
                          max={quantityLimit}
                          step={1}
                          value={[quantityMin, quantityMax]}
                          onValueChange={(value) => {
                            setQuantityMin(value[0] ?? 0);
                            setQuantityMax(value[1] ?? quantityLimit);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-4">
                    <p className="text-xs text-muted-foreground">
                      {filteredRows.length} proveedores encontrados
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      disabled={activeFilterCount === 0}
                      className="h-8 px-2 text-xs"
                    >
                      <X className="mr-1 size-3.5" /> Limpiar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              onClick={exportExcel}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700"
            >
              <Sheet className="size-4" />
              Exportar Excel
            </Button>
            <Button
              onClick={exportPdf}
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700"
            >
              <FileText className="size-4" />
              Exportar PDF
            </Button>
          </div>
        </div>

        <Dialog open={newSupplierOpen} onOpenChange={(open) => !open && closeSupplierEditor()}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-3">
                <DialogTitle>
                  {editingSupplierKey ? "Editar proveedor" : "Nuevo proveedor"}
                </DialogTitle>
                {editingSupplierKey && bulkSupplierEditQueue.length > 1 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigateBulkEditSupplier(-1)}
                      disabled={bulkSupplierEditPosition === 0}
                    >
                      <ArrowLeft className="size-4" /> Anterior
                    </Button>
                    <span>
                      {bulkSupplierEditPosition + 1} / {bulkSupplierEditQueue.length}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigateBulkEditSupplier(1)}
                      disabled={bulkSupplierEditPosition >= bulkSupplierEditQueue.length - 1}
                    >
                      Siguiente <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
              <DialogDescription>
                {editingSupplierKey
                  ? "Actualizá el nombre, celular y red social del proveedor."
                  : "Ingresá los datos del nuevo proveedor."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Nombre</Label>
                <Input
                  id="supplier-name"
                  name="new-supplier-name"
                  autoComplete="off"
                  value={newSupplier.name}
                  onChange={(event) =>
                    setNewSupplier((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Celular</Label>
                <Input
                  id="supplier-phone"
                  name="new-supplier-phone"
                  autoComplete="off"
                  value={newSupplier.phone}
                  onChange={(event) =>
                    setNewSupplier((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-social">Red social</Label>
                <Input
                  id="supplier-social"
                  name="new-supplier-social"
                  autoComplete="off"
                  value={newSupplier.social}
                  onChange={(event) =>
                    setNewSupplier((current) => ({ ...current, social: event.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <div className="flex w-full items-center justify-between gap-2">
                {editingSupplierKey && bulkSupplierEditQueue.length > 1 ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigateBulkEditSupplier(-1)}
                      disabled={bulkSupplierEditPosition === 0}
                    >
                      <ArrowLeft className="size-4" /> Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigateBulkEditSupplier(1)}
                      disabled={bulkSupplierEditPosition >= bulkSupplierEditQueue.length - 1}
                    >
                      Siguiente <ArrowRight className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  onClick={addSupplier}
                  disabled={
                    !newSupplier.name.trim() ||
                    !newSupplier.phone.trim() ||
                    !newSupplier.social.trim() ||
                    !supplierFormHasChanges
                  }
                >
                  <Save className="size-4" />
                  Guardar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <FilterChipList chips={filterChips} />
        <div className="mt-2 flex min-h-9 basis-full flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 leading-none">
            <button
              type="button"
              className="text-sm font-medium text-foreground leading-none"
              onClick={() => {
                setSelectionMode((current) => {
                  if (current) setSelectedSupplierKeys([]);
                  return !current;
                });
              }}
            >
              Seleccionar
            </button>
            <Checkbox
              className="h-4 w-4 rounded-full border-2 border-primary bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              checked={
                allVisibleSuppliersSelected
                  ? true
                  : someVisibleSuppliersSelected
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(checked) => {
                if (checked === false) {
                  setSelectionMode(false);
                  setSelectedSupplierKeys([]);
                  return;
                }
                setSelectionMode(true);
                const shouldSelect = checked === true || checked === "indeterminate";
                setSelectedSupplierKeys((current) =>
                  shouldSelect
                    ? [...new Set([...current, ...visibleSupplierKeys])]
                    : current.filter((key) => !visibleSupplierKeys.includes(key)),
                );
              }}
              aria-label="Seleccionar proveedores visibles"
            />
            {selectedSupplierKeys.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {selectedSupplierKeys.length} seleccionados
              </span>
            ) : null}
          </div>
          {selectedSupplierKeys.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={startBulkQuickEditSuppliers}>
                <Edit3 className="size-4" /> Editar rápido
              </Button>
              <Button size="sm" variant="outline" onClick={editSelectedSupplier}>
                <Pencil className="size-4" /> Editar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (window.confirm("¿Eliminar proveedores seleccionados?")) {
                    deleteSelectedSuppliers();
                  }
                }}
              >
                <Trash2 className="size-4" /> Eliminar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedSupplierKeys([]);
                }}
              >
                <X className="size-4" /> Cancelar
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl">
          <div className="glass-panel min-w-0 overflow-visible rounded-2xl">
            <Table
              hideScrollbarOnMobile
              alwaysShowScrollbarOnDesktop
              stickyHeader
              stickyScrollbar
              containerClassName={cn(
                "overflow-y-visible",
                hasExpandedSupplier ? "overflow-x-hidden" : "overflow-x-auto",
              )}
              className={cn(
                "w-full table-fixed text-center text-sm text-foreground [&_td]:align-middle [&_th]:align-middle [&_td]:py-1 [&_th]:py-1",
                hasExpandedSupplier ? "min-w-0" : selectionMode ? "min-w-200" : "min-w-312",
              )}
            >
              <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-center [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead className="w-10 px-1"> </TableHead>
                  <TableHead className="w-48 min-w-48 pl-5">Nombre</TableHead>
                  <TableHead className="w-36 min-w-36">Celular</TableHead>
                  <TableHead className="w-40 min-w-40">Red social</TableHead>
                  <TableHead className="w-40 min-w-40">Total vendido</TableHead>
                  <TableHead className="w-36 min-w-36">Cantidad vendida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const isExpanded = expandedSupplierKey === row.key;
                  const isQuickEditing = quickEditSupplierKey === row.key;
                  const sortedProducts = [...row.products].sort((a, b) =>
                    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
                  );
                  const quickSupplier = quickEditSupplier ?? {
                    name: row.name,
                    phone: row.phone,
                    social: row.social,
                  };
                  return (
                    <React.Fragment key={row.key}>
                      <TableRow
                        onClick={(event) => {
                          if (
                            selectionMode ||
                            isQuickEditing ||
                            (event.target as HTMLElement).closest(
                              "button, input, [role=combobox], a",
                            )
                          )
                            return;
                          if (quickEditSupplierKey !== null && quickEditSupplierKey !== row.key) {
                            cancelQuickEditSupplier();
                          }
                          setExpandedSupplierKey(isExpanded ? null : row.key);
                        }}
                        className={
                          !selectionMode && !isQuickEditing
                            ? "cursor-pointer hover:bg-transparent"
                            : undefined
                        }
                      >
                        <TableCell className="w-10 px-1">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              className="h-4 w-4 rounded-full border-2 border-primary bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                              checked={selectedSupplierKeys.includes(row.key)}
                              onCheckedChange={(checked) => {
                                const isChecked = checked === true;
                                setSelectedSupplierKeys((current) => {
                                  const next = isChecked
                                    ? [...new Set([...current, row.key])]
                                    : current.filter((key) => key !== row.key);
                                  setSelectionMode(next.length > 0);
                                  return next;
                                });
                              }}
                              aria-label={`Seleccionar proveedor ${row.name}`}
                            />
                          </div>
                        </TableCell>

                        <TableCell className="pl-5 text-center text-sm font-medium text-foreground">
                          {isQuickEditing ? (
                            <Input
                              value={quickSupplier.name}
                              onChange={(event) =>
                                setQuickEditSupplier({ ...quickSupplier, name: event.target.value })
                              }
                              className="h-9"
                            />
                          ) : (
                            row.name
                          )}
                        </TableCell>
                        <TableCell className="w-36 min-w-36 text-center text-sm text-foreground">
                          {isQuickEditing ? (
                            <Input
                              value={quickSupplier.phone}
                              onChange={(event) =>
                                setQuickEditSupplier({
                                  ...quickSupplier,
                                  phone: event.target.value,
                                })
                              }
                              className="h-9"
                            />
                          ) : (
                            row.phone
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm text-foreground">
                          {isQuickEditing ? (
                            <Input
                              value={quickSupplier.social}
                              onChange={(event) =>
                                setQuickEditSupplier({
                                  ...quickSupplier,
                                  social: event.target.value,
                                })
                              }
                              className="h-9"
                            />
                          ) : (
                            row.social
                          )}
                        </TableCell>
                        <TableCell className="min-w-32 text-center">
                          <div className="flex flex-col items-center justify-center gap-1 leading-none text-foreground">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                $
                              </span>
                              <span className="text-sm">
                                {formatNumber(row.salesByCurrency.ARS)}
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-[11px] font-medium text-muted-foreground">
                                USD
                              </span>
                              <span className="text-sm">
                                {formatNumber(row.salesByCurrency.USD)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-foreground">
                          {row.soldQuantity}
                        </TableCell>
                        {!selectionMode && !hasExpandedSupplier && (
                          <TableCell
                            className={cn(
                              "whitespace-nowrap pr-5 text-center",
                              isQuickEditing ? "w-32 min-w-32" : "w-108 min-w-108",
                            )}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex min-w-max flex-nowrap items-center justify-center gap-1.5">
                              {isQuickEditing ? (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => saveSupplierChanges(row.key, quickSupplier)}
                                    className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                                  >
                                    <Check className="size-3.5" /> Guardar
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={cancelQuickEditSupplier}
                                    className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                                  >
                                    <X className="size-3.5" /> Cancelar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setExpandedSupplierKey(isExpanded ? null : row.key)
                                    }
                                    className="h-6 shrink-0 gap-1 whitespace-nowrap bg-transparent px-1.5 text-[10px] font-medium text-foreground shadow-none hover:bg-accent hover:text-accent-foreground"
                                  >
                                    {isExpanded ? (
                                      <EyeOff className="size-4" />
                                    ) : (
                                      <Eye className="size-4" />
                                    )}
                                    {isExpanded ? "Ocultar" : "Detalles"}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => startQuickEditSupplier(row)}
                                    className="h-6 shrink-0 gap-1 whitespace-nowrap bg-transparent px-1.5 text-[10px]"
                                  >
                                    <Edit3 className="size-3.5" /> Editar rápido
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openSupplierEditor(row)}
                                    className="h-6 shrink-0 gap-1 whitespace-nowrap bg-transparent px-1.5 text-[10px]"
                                  >
                                    <Pencil className="size-3.5" /> Editar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (window.confirm(`¿Eliminar el proveedor "${row.name}"?`)) {
                                        deleteSupplier(row.key);
                                      }
                                    }}
                                    className="h-6 shrink-0 gap-1 whitespace-nowrap bg-transparent px-1.5 text-[10px] text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="size-3.5" /> Eliminar
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                      {isExpanded ? (
                        <TableRow>
                          <TableCell
                            colSpan={selectionMode || hasExpandedSupplier ? 6 : 7}
                            className="w-full bg-muted/30 p-0 text-left"
                          >
                            <>
                                <p className="mb-2 px-5 pt-6 font-medium">Productos</p>
                              <div className="space-y-1.5 px-5">
                                  {sortedProducts.slice(0, 8).map((product) => (
                                    <div
                                      key={product.name}
                                      className="flex items-center justify-start gap-4 px-2.5 py-1.5 text-xs text-foreground"
                                    >
                                      <span className="min-w-0 wrap-break-word">{product.name}</span>
                                      <span className="shrink-0 text-muted-foreground">
                                        Cantidad vendida: {product.quantity}
                                      </span>
                                    </div>
                                  ))}
                                  {row.products.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                      Este proveedor todavía no tiene productos vendidos.
                                    </p>
                                  )}
                                  {sortedProducts.length > 8 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setProductsModalSupplier(row)}
                                      className="px-2 text-xs"
                                    >
                                      Ver más
                                    </Button>
                                  )}
                              </div>
                            </>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  isQuickEditing
                                    ? saveSupplierChanges(row.key, quickSupplier)
                                    : startQuickEditSupplier(row, true)
                                }
                                className={cn(
                                  "h-8 gap-2 rounded-md border border-input bg-background px-3 text-xs shadow-none hover:bg-accent hover:text-accent-foreground",
                                  isQuickEditing &&
                                    "border-transparent bg-transparent px-2 text-green-600 hover:bg-green-100/80 hover:text-green-700",
                                )}
                              >
                                {isQuickEditing ? (
                                  <>
                                    <Check className="size-3.5" /> Guardar
                                  </>
                                ) : (
                                  <>
                                    <Edit3 className="size-3.5" /> Editar rápido
                                  </>
                                )}
                              </Button>
                              {isQuickEditing ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelQuickEditSupplier}
                                  className="h-7 gap-1 bg-transparent px-2 text-xs text-destructive hover:bg-destructive/10"
                                >
                                  <X className="size-3.5" /> Cancelar
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openSupplierEditor(row)}
                                    className="h-8 gap-2 rounded-md border border-input bg-background px-3 text-xs shadow-none hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Pencil className="size-3.5" /> Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (window.confirm(`¿Eliminar el proveedor "${row.name}"?`)) {
                                        deleteSupplier(row.key);
                                      }
                                    }}
                                    className="h-8 gap-2 rounded-md border border-input bg-background px-3 text-xs text-destructive shadow-none hover:bg-destructive/10"
                                  >
                                    <Trash2 className="size-3.5" /> Eliminar
                                  </Button>
                                </>
                              )}
                              {!isQuickEditing && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setExpandedSupplierKey(null)}
                                  className="h-8 gap-2 rounded-md px-3 text-xs"
                                >
                                  <EyeOff className="size-4" /> Ocultar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-16 text-muted-foreground">
                      No se encontraron proveedores.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 pb-20">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPage(0)}
              disabled={!hasPreviousPage}
              className="h-9 px-4"
            >
              Principio
            </Button>
            <div className="flex items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`h-9 min-w-9 rounded-xl border border-input px-3 py-1.5 text-sm outline-none transition-colors focus-visible:outline-none ${
                    index === page
                      ? "bg-muted text-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-surface-2"
                  }`}
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
              onChange={(event) => setPageSizeInput(event.target.value)}
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
            {visibleRows.length} de {filteredRows.length} proveedores mostrados
          </p>
        </div>
      </div>

      <Dialog
        open={productsModalSupplier !== null}
        onOpenChange={(open) => !open && setProductsModalSupplier(null)}
      >
        <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Productos de {productsModalSupplier?.name}</DialogTitle>
            <DialogDescription>Listado completo de productos vendidos.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(70vh,32rem)] space-y-1.5 overflow-y-auto">
            {[...(productsModalSupplier?.products ?? [])]
              .filter((product) => product.quantity > 0)
              .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
              .map((product) => (
                <div
                  key={product.name}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm"
                >
                  <span className="min-w-0 wrap-break-word">{product.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    Cantidad vendida: {product.quantity}
                  </span>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
