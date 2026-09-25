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
import { saveOrders } from "@/data/orders";
import { moveToTrash } from "@/data/trash";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/admin/proveedores")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(catalogQueries.allAdmin()),
      context.queryClient.ensureQueryData(catalogQueries.settings()),
    ]);
  },
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminSuppliers,
});

type SupplierRow = {
  id?: string;
  key: string;
  name: string;
  phone: string;
  social: string;
  products: Array<{ name: string; variantName?: string; quantity: number }>;
  stores: string[];
  sales: number;
  salesByCurrency: Record<"ARS" | "USD", number>;
  soldQuantity: number;
};

type StandaloneSupplier = {
  id?: string;
  name: string;
  phone: string;
  social: string;
};

const SUPPLIERS_STORAGE_KEY = "lrg:suppliers";
const DELETED_SUPPLIERS_STORAGE_KEY = "lrg:deletedSuppliers";

const getSupplierKey = (supplier: Pick<StandaloneSupplier, "name" | "phone" | "social">) =>
  [supplier.name, supplier.phone, supplier.social].map((value) => value.trim()).join("|");

const getSupplierIdentity = (supplier: Pick<StandaloneSupplier, "id" | "name" | "phone" | "social">) =>
  supplier.id ?? getSupplierKey(supplier);

const matchesSupplierKey = (
  supplier: Partial<StandaloneSupplier> | { name: string; phone: string; social: string } | null | undefined,
  supplierKey: string,
) => {
  if (!supplier) return false;
  const supplierId = "id" in supplier ? supplier.id : undefined;
  return (supplierId !== undefined && supplierId === supplierKey) ||
    getSupplierKey(supplier as Pick<StandaloneSupplier, "name" | "phone" | "social">) === supplierKey;
};

const withSupplierIdentity = (supplier: StandaloneSupplier) => ({
  ...supplier,
  id: supplier.id ?? getSupplierKey(supplier),
});

const normalizeSupplier = (supplier: Partial<StandaloneSupplier> | null | undefined) => ({
  id: supplier?.id,
  name: supplier?.name?.trim() ?? "",
  phone: supplier?.phone?.trim() ?? "",
  social: supplier?.social?.trim() ?? "",
});

const dedupeSuppliers = (suppliers: StandaloneSupplier[]) => {
  const byKey = new Map<string, StandaloneSupplier>();
  for (const supplier of suppliers) {
    const normalized = normalizeSupplier(supplier);
    const key = getSupplierKey(normalized);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...normalized,
        id: supplier.id ?? key,
      });
      continue;
    }
    byKey.set(key, {
      ...existing,
      ...normalized,
      id: existing.id ?? supplier.id ?? key,
    });
  }
  return Array.from(byKey.values());
};

const replaceSupplierRecord = (
  suppliers: StandaloneSupplier[],
  supplierKey: string,
  nextSupplier: StandaloneSupplier,
) => {
  const withoutTarget = suppliers.filter(
    (supplier) => !(supplier.id === supplierKey || getSupplierKey(normalizeSupplier(supplier)) === supplierKey),
  );
  return dedupeSuppliers([...withoutTarget, nextSupplier]);
};

function AdminSuppliers() {
  const { data: products } = useSuspenseQuery(catalogQueries.allAdmin());
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
  const [deletedSupplierKeys, setDeletedSupplierKeys] = React.useState<string[]>([]);

  React.useEffect(() => {
    const deletedSetting = settings.find(
      (setting) => setting.settingKey === DELETED_SUPPLIERS_STORAGE_KEY,
    );
    if (deletedSetting) {
      try {
        const parsed = JSON.parse(deletedSetting.settingValue) as unknown;
        setDeletedSupplierKeys(
          Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [],
        );
      } catch {
        setDeletedSupplierKeys([]);
      }
    } else {
      setDeletedSupplierKeys([]);
    }

    const stored = settings.find((setting) => setting.settingKey === SUPPLIERS_STORAGE_KEY);
    if (!stored) {
      setStandaloneSuppliers([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored.settingValue) as unknown;
      setStandaloneSuppliers(
        Array.isArray(parsed)
          ? (parsed as StandaloneSupplier[]).map((supplier) => withSupplierIdentity(supplier))
          : [],
      );
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
  const [bulkSupplierEditCompletedKeys, setBulkSupplierEditCompletedKeys] = React.useState<string[]>([]);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [quickEditSupplierKey, setQuickEditSupplierKey] = React.useState<string | null>(null);
  const [quickEditSupplier, setQuickEditSupplier] = React.useState<StandaloneSupplier | null>(null);
  const [quickEditFromDetails, setQuickEditFromDetails] = React.useState(false);
  const [quickEditSupplierQueue, setQuickEditSupplierQueue] = React.useState<string[]>([]);
  const [editingSupplierKey, setEditingSupplierKey] = React.useState<string | null>(null);
  const [supplierDeleteConfirmOpen, setSupplierDeleteConfirmOpen] = React.useState(false);
  const [pendingSupplierDelete, setPendingSupplierDelete] = React.useState<(() => void) | null>(null);
  const supplierFormKey = `${newSupplier.name.trim()}|${newSupplier.phone.trim()}|${newSupplier.social.trim()}`;
  const supplierFormHasChanges = !editingSupplierKey || supplierFormKey !== editingSupplierKey;

  const saveDeletedSupplierKeys = (nextKeys: string[]) => {
    const uniqueKeys = Array.from(new Set(nextKeys));
    setDeletedSupplierKeys(uniqueKeys);
    void saveAdminSetting({
      data: {
        settingKey: DELETED_SUPPLIERS_STORAGE_KEY,
        settingValue: JSON.stringify(uniqueKeys),
      },
    });
  };

  const toggleSupplierSelection = (key: string, checked: boolean) => {
    setSelectedSupplierKeys((current) =>
      checked ? [...new Set([...current, key])] : current.filter((item) => item !== key),
    );
  };

  const rows = React.useMemo<SupplierRow[]>(() => {
    const grouped = new Map<string, SupplierRow>();
    const countedOrderItems = new Set<string>();
    for (const product of products) {
      const assignments = product.variants?.length
        ? product.variants.map((variant) => ({
            supplier: variant.supplier ?? product.supplier,
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
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
              variantName: undefined,
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
        const key = getSupplierKey({ name, phone, social });
        if (deletedSupplierKeys.includes(key)) continue;
        const assignmentSummary = orders.reduce(
          (summary, order) => {
            for (const [itemIndex, item] of order.items.entries()) {
              if (item.supplier) continue;
              const orderItemKey = `${order.id}:${itemIndex}`;
              const itemName = item.name.toLowerCase();
              const itemVariantName = item.variantName?.toLowerCase();
              const matchesById =
                item.productId === assignment.productId && item.variantId === assignment.variantId;
              const matchesLegacy =
                !item.productId &&
                (product.variants?.length
                  ? Boolean(
                      assignment.variantName &&
                        (itemName === assignment.variantName.toLowerCase() ||
                          itemVariantName === assignment.variantName.toLowerCase()),
                    )
                  : itemName === assignment.productName.toLowerCase());
                    if (countedOrderItems.has(orderItemKey)) continue;
                    countedOrderItems.add(orderItemKey);
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
            (item) =>
              item.name === assignment.productName && item.variantName === assignment.variantName,
          );
          if (currentProduct) {
            currentProduct.quantity += assignmentSummary.quantity;
          } else {
            current.products.push({
              name: assignment.productName,
              variantName: assignment.variantName,
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
        const key = getSupplierKey({ name, phone, social });
        if (deletedSupplierKeys.includes(key)) continue;
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
        const currentProduct = current.products.find(
          (product) => product.name === item.name && product.variantName === item.variantName,
        );
        if (currentProduct) {
          currentProduct.quantity += item.quantity;
        } else {
          current.products.push({
            name: item.name,
            variantName: item.variantName,
            quantity: item.quantity,
          });
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
      const key = getSupplierKey(supplier);
      if (deletedSupplierKeys.includes(key)) continue;
      const existing = grouped.get(key);
      if (existing) {
        existing.id = existing.id ?? getSupplierIdentity(supplier);
        continue;
      }
      grouped.set(key, {
        id: getSupplierIdentity(supplier),
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
  }, [deletedSupplierKeys, orders, products, standaloneSuppliers]);

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
    setBulkSupplierEditCompletedKeys([]);
    setSelectedSupplierKeys([]);
    setSelectionMode(false);
  };

  const addSupplier = () => {
    const supplier = withSupplierIdentity({
      id: newSupplier.id,
      name: newSupplier.name.trim(),
      phone: newSupplier.phone.trim(),
      social: newSupplier.social.trim(),
    });
    if (!supplier.name || !supplier.phone || !supplier.social) return;
    if (editingSupplierKey) {
      saveSupplierChanges(editingSupplierKey, supplier, bulkSupplierEditQueue.length === 0);

      const completedKeys = new Set([...bulkSupplierEditCompletedKeys, editingSupplierKey]);
      const currentIndex = bulkSupplierEditQueue.indexOf(editingSupplierKey);
      const nextKey = (() => {
        for (let offset = 1; offset < bulkSupplierEditQueue.length; offset += 1) {
          const candidateIndex = currentIndex + offset;
          const candidateKey = bulkSupplierEditQueue[candidateIndex];
          if (candidateKey && !completedKeys.has(candidateKey)) {
            return candidateKey;
          }
        }
        for (let offset = 1; offset <= currentIndex; offset += 1) {
          const candidateIndex = currentIndex - offset;
          const candidateKey = bulkSupplierEditQueue[candidateIndex];
          if (candidateKey && !completedKeys.has(candidateKey)) {
            return candidateKey;
          }
        }
        return null;
      })();

      setBulkSupplierEditCompletedKeys(Array.from(completedKeys));

      if (nextKey) {
        const nextRow =
          filteredRows.find((row) => row.key === nextKey) ?? rows.find((row) => row.key === nextKey);
        if (nextRow) {
          const nextPosition = bulkSupplierEditQueue.indexOf(nextKey);
          setBulkSupplierEditPosition(nextPosition);
          openSupplierEditor(nextRow);
          return;
        }
      }

      closeSupplierEditor();
      return;
    }
    const nextSuppliers = dedupeSuppliers([...standaloneSuppliers, supplier]);
    setStandaloneSuppliers(nextSuppliers);
    void saveAdminSetting({
      data: { settingKey: SUPPLIERS_STORAGE_KEY, settingValue: JSON.stringify(nextSuppliers) },
    });
    setNewSupplier({ name: "", phone: "", social: "" });
    setNewSupplierOpen(false);
  };

  const openSupplierEditor = (row: SupplierRow) => {
    setEditingSupplierKey(row.key);
    setNewSupplier({ id: row.id ?? row.key, name: row.name, phone: row.phone, social: row.social });
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
    setSelectionMode(true);
    setQuickEditSupplierQueue(queue.slice(1).map((row) => row.key));
    startQuickEditSupplier(firstRow);
  };

  const cancelQuickEditSupplier = () => {
    const currentKey = quickEditSupplierKey;
    const remainingQueue = quickEditSupplierQueue.filter((key) => key !== currentKey);
    const nextQueuedKey = remainingQueue[0];
    const nextRow = nextQueuedKey ? rows.find((row) => row.key === nextQueuedKey) : null;

    setQuickEditSupplierKey(null);
    setQuickEditSupplier(null);
    setQuickEditFromDetails(false);
    setQuickEditSupplierQueue(remainingQueue);

    if (nextRow) {
      setSelectionMode(true);
      startQuickEditSupplier(nextRow);
      return;
    }

    setSelectionMode(selectedSupplierKeys.length > 0);
  };

  const cancelQuickEditSupplierSession = () => {
    setQuickEditSupplierKey(null);
    setQuickEditSupplier(null);
    setQuickEditFromDetails(false);
    setQuickEditSupplierQueue([]);
    setExpandedSupplierKey(null);
    setSelectionMode(false);
    setSelectedSupplierKeys([]);
  };

  const saveSupplierChanges = (
    supplierKey: string,
    nextSupplier: StandaloneSupplier,
    closeEditor = true,
  ) => {
    const target = normalizeSupplier(nextSupplier);
    const persistedSupplier = standaloneSuppliers.find(
      (supplier) => supplier.id === supplierKey || getSupplierKey(supplier) === supplierKey,
    );
    const normalized = withSupplierIdentity({
      id: persistedSupplier?.id ?? nextSupplier.id ?? supplierKey,
      name: target.name,
      phone: target.phone,
      social: target.social,
    });
    if (!normalized.name || !normalized.phone || !normalized.social) return;
    const normalizedKey = getSupplierKey(normalized);
    saveDeletedSupplierKeys(
      deletedSupplierKeys.filter((key) => key !== supplierKey && key !== normalizedKey),
    );

    const nextStandaloneSuppliers = dedupeSuppliers([
      ...standaloneSuppliers.filter(
        (supplier) => !matchesSupplierKey(supplier, supplierKey),
      ),
      normalized,
    ]);

    const nextProducts = (products as Product[]).map((product) => ({
      ...product,
      supplier:
        product.supplier &&
        matchesSupplierKey(product.supplier, supplierKey)
          ? { ...product.supplier, ...normalized, id: normalized.id ?? getSupplierKey(normalized) }
          : product.supplier,
      variants: product.variants?.map((variant) => ({
        ...variant,
        supplier:
          variant.supplier &&
          matchesSupplierKey(variant.supplier, supplierKey)
            ? { ...variant.supplier, ...normalized, id: normalized.id ?? getSupplierKey(normalized) }
            : variant.supplier,
      })),
    }));
    const nextOrders = orders.map((order) => ({
      ...order,
      items: order.items.map((item) =>
        item.supplier &&
        matchesSupplierKey(item.supplier, supplierKey)
          ? { ...item, supplier: { ...item.supplier, ...normalized } }
          : item,
      ),
    }));

    setStandaloneSuppliers(nextStandaloneSuppliers);
    void saveAdminSetting({
      data: {
        settingKey: SUPPLIERS_STORAGE_KEY,
        settingValue: JSON.stringify(nextStandaloneSuppliers),
      },
    });
    saveProducts(nextProducts);
    queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void saveOrders(nextOrders);
    queryClient.setQueryData(orderQueries.list().queryKey, nextOrders);
    const currentKey = supplierKey;
    const remainingQueue = quickEditSupplierQueue.filter((key) => key !== currentKey);
    const nextQueuedKey = remainingQueue[0];
    setQuickEditSupplierKey(null);
    setQuickEditSupplier(null);
    setQuickEditFromDetails(false);

    setQuickEditSupplierQueue(remainingQueue);
    if (closeEditor && nextQueuedKey) {
      const nextRow = rows.find((row) => row.key === nextQueuedKey);
      if (nextRow) {
        setSelectionMode(true);
        startQuickEditSupplier(nextRow);
        return;
      }
    }

    if (closeEditor) {
      setSelectionMode(selectedSupplierKeys.length > 0);
      setEditingSupplierKey(null);
    }
    toast.success("Proveedor guardado");
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
    const nextStandaloneSuppliers = dedupeSuppliers(
      standaloneSuppliers.filter(
        (supplier) =>
          !matchesSupplierKey(supplier, supplierKey),
      ),
    );
    const nextProducts = (products as Product[]).map((product) => ({
      ...product,
      supplier:
        product.supplier &&
        matchesSupplierKey(product.supplier, supplierKey)
          ? undefined
          : product.supplier,
      variants: product.variants?.map((variant) => ({
        ...variant,
        supplier:
          variant.supplier &&
          matchesSupplierKey(variant.supplier, supplierKey)
            ? undefined
            : variant.supplier,
      })),
    }));
    const nextOrders = orders;

    setStandaloneSuppliers(nextStandaloneSuppliers);
    setSelectedSupplierKeys((current) => current.filter((key) => key !== supplierKey));
    saveDeletedSupplierKeys([...deletedSupplierKeys, supplierKey]);
    void saveAdminSetting({
      data: {
        settingKey: SUPPLIERS_STORAGE_KEY,
        settingValue: JSON.stringify(nextStandaloneSuppliers),
      },
    });
    saveProducts(nextProducts);
    queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void saveOrders(nextOrders);
    queryClient.setQueryData(orderQueries.list().queryKey, nextOrders);
  };

  const editSelectedSupplier = () => {
    const selectedRow = filteredRows.find((row) => selectedSupplierKeys.includes(row.key));
    if (selectedRow) {
      const selectedKeys = new Set(selectedSupplierKeys);
      const queue = filteredRows.filter((row) => selectedKeys.has(row.key)).map((row) => row.key);
      setBulkSupplierEditQueue(queue);
      setBulkSupplierEditPosition(0);
      setBulkSupplierEditCompletedKeys([]);
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

  const countSupplierLinkedItems = (supplierKey: string) => {
    let linkedProducts = 0;
    let linkedVariants = 0;

    for (const product of products) {
      if (product.supplier && matchesSupplierKey(product.supplier, supplierKey)) {
        linkedProducts += 1;
      }
      for (const variant of product.variants ?? []) {
        if (variant.supplier && matchesSupplierKey(variant.supplier, supplierKey)) {
          linkedVariants += 1;
        }
      }
    }

    return { linkedProducts, linkedVariants };
  };

  const deleteSelectedSuppliers = () => {
    const selectedKeysSnapshot = [...selectedSupplierKeys];
    const selectedRowsSnapshot = filteredRows.filter((row) => selectedKeysSnapshot.includes(row.key));
    setSelectedSupplierKeys([]);
    setSelectionMode(false);

    const selectedKeys = new Set(selectedSupplierKeys);
    const selectedRows = selectedRowsSnapshot;
    const linkedEntries = filteredRows
      .filter((row) => selectedKeysSnapshot.includes(row.key))
      .map((row) => ({ row, usage: countSupplierLinkedItems(row.key) }));

    filteredRows
      .filter((row) => selectedKeysSnapshot.includes(row.key))
      .forEach((row) =>
        moveToTrash({
          type: "proveedor",
          id: row.key,
          item: { name: row.name, phone: row.phone, social: row.social },
        }),
      );

    const nextStandaloneSuppliers = dedupeSuppliers(
      standaloneSuppliers.filter(
        (supplier) =>
          !selectedRows.some((row) => matchesSupplierKey(supplier, row.key)),
      ),
    );
    const nextProducts = (products as Product[]).map((product) => ({
      ...product,
      supplier:
        product.supplier &&
        selectedRows.some((row) => matchesSupplierKey(product.supplier, row.key))
          ? undefined
          : product.supplier,
      variants: product.variants?.map((variant) => ({
        ...variant,
        supplier:
          variant.supplier &&
          selectedRows.some((row) => matchesSupplierKey(variant.supplier, row.key))
            ? undefined
            : variant.supplier,
      })),
    }));
    const nextOrders = orders;

    const linkedCount = linkedEntries.reduce(
      (sum, entry) => sum + entry.usage.linkedProducts + entry.usage.linkedVariants,
      0,
    );

    setStandaloneSuppliers(nextStandaloneSuppliers);
    saveDeletedSupplierKeys([...deletedSupplierKeys, ...selectedKeys]);
    void saveAdminSetting({
      data: {
        settingKey: SUPPLIERS_STORAGE_KEY,
        settingValue: JSON.stringify(nextStandaloneSuppliers),
      },
    });
    saveProducts(nextProducts);
    queryClient.setQueryData(catalogQueries.allAdmin().queryKey, nextProducts);
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void saveOrders(nextOrders);
    queryClient.setQueryData(orderQueries.list().queryKey, nextOrders);

    if (linkedCount > 0) {
      toast.success(`Proveedor/es eliminado/s. Se desvincularon ${linkedCount} referencias de productos/variantes.`);
    }
  };

  const selectedSupplierDeleteSummary = React.useMemo(() => {
    const keys = selectedSupplierKeys;
    if (keys.length === 0) {
      return { productLinks: 0, variantLinks: 0, total: 0 };
    }

    return keys.reduce(
      (summary, key) => {
        const usage = countSupplierLinkedItems(key);
        summary.productLinks += usage.linkedProducts;
        summary.variantLinks += usage.linkedVariants;
        summary.total += usage.linkedProducts + usage.linkedVariants;
        return summary;
      },
      { productLinks: 0, variantLinks: 0, total: 0 },
    );
  }, [selectedSupplierKeys, products]);

  const filteredRows = rows
    .filter((row) => {
      const selectedSales = currencyFilter.reduce(
        (sum, currency) => sum + row.salesByCurrency[currency],
        0,
      );
      const searchableValues = [row.name, row.phone, row.social, ...row.products.map((entry) => entry.name)];
      return (
        searchableValues.some((value) => value.toLowerCase().includes(query.toLowerCase())) &&
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
      ["Nombre", "Celular", "Red social", "Producto", "Total vendido ($/USD)", "Cantidad vendida"],
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
      `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #d4d4d4;padding:8px;text-align:left}th{background:#f3f3f3}</style></head><body><h2>Proveedores</h2><table border="1" cellpadding="6"><thead><tr><th>Nombre</th><th>Celular</th><th>Red social</th><th>Producto</th><th>Total vendido</th><th>Cantidad vendida</th></tr></thead><tbody>${exportRows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`,
    );
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
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
          <div className="order-3 flex basis-full min-w-0 flex-col items-stretch gap-2 sm:basis-auto sm:flex-row sm:items-center sm:justify-end sm:shrink-0">
            <div className="flex min-w-0 flex-row items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x sm:overflow-visible sm:pb-0">
            <Dialog open={sortOpen} onOpenChange={setSortOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 whitespace-nowrap px-2.5">
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
            </div>
            <div className="flex min-w-0 flex-row items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 touch-pan-x sm:overflow-visible sm:pb-0">

            <Button
              onClick={exportExcel}
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700"
            >
              <Sheet className="size-4" />
              Exportar Excel
            </Button>
            <Button
              onClick={exportPdf}
              className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700"
            >
              <FileText className="size-4" />
              Exportar PDF
            </Button>
            </div>
          </div>
        </div>

        <Dialog open={newSupplierOpen} onOpenChange={(open) => !open && closeSupplierEditor()}>
          <DialogContent
            className="w-[calc(100vw-1rem)] max-w-2xl max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-auto"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
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
                <span />
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
                <div className="flex items-center gap-2">
                  {editingSupplierKey ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        const supplierKey = editingSupplierKey;
                        setPendingSupplierDelete(() => {
                          deleteSupplier(supplierKey);
                          closeSupplierEditor();
                        });
                        setSupplierDeleteConfirmOpen(true);
                      }}
                      className="gap-2"
                    >
                      <Trash2 className="size-4" /> Eliminar
                    </Button>
                  ) : null}
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
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="flex flex-col">
        <FilterChipList chips={filterChips} />
        <div className="order-2 mt-2 flex min-h-9 basis-full flex-wrap items-center gap-3">
          {selectedSupplierKeys.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {quickEditSupplierKey !== null ? (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      if (quickEditSupplierKey && quickEditSupplier) {
                        saveSupplierChanges(quickEditSupplierKey, quickEditSupplier);
                      }
                    }}
                  >
                    <Check className="size-4" /> Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={cancelQuickEditSupplier}
                  >
                    <X className="size-4" /> Saltar
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelQuickEditSupplierSession}>
                    <X className="size-4" /> Cancelar
                  </Button>
                </>
              ) : (
                <>
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
                      setPendingSupplierDelete(() => deleteSelectedSuppliers);
                      setSupplierDeleteConfirmOpen(true);
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
                </>
              )}
            </div>
          ) : null}
        </div>

        <div className="order-1 mt-4 rounded-2xl">
          <div className="glass-panel min-w-0 overflow-visible rounded-2xl">
            <Table
              hideScrollbarOnMobile
              alwaysShowScrollbarOnDesktop
              stickyHeader
              stickyScrollbar
              containerClassName="overflow-x-auto overflow-y-visible overscroll-x-contain [-webkit-overflow-scrolling:touch]"
              className="min-w-[52rem] w-full table-auto text-center text-sm text-foreground [&_td]:align-middle [&_th]:align-middle [&_td]:py-1 [&_th]:py-1"
            >
              <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-center [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
                <TableRow>
                              <TableHead className="w-12 min-w-12 max-w-12 px-2">
                                <div className="flex items-center justify-center">
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
                                      const shouldSelect = checked === true || checked === "indeterminate";
                                      setSelectedSupplierKeys((current) => {
                                        const next = shouldSelect
                                          ? [...new Set([...current, ...visibleSupplierKeys])]
                                          : current.filter((key) => !visibleSupplierKeys.includes(key));
                                        setSelectionMode(next.length > 0);
                                        return next;
                                      });
                                    }}
                                    aria-label="Seleccionar proveedores visibles"
                                  />
                                </div>
                              </TableHead>
                  <TableHead className="w-[24%] min-w-[150px] pl-5">Nombre</TableHead>
                  <TableHead className="w-[16%] min-w-[110px]">Celular</TableHead>
                  <TableHead className="w-[18%] min-w-[120px]">Red social</TableHead>
                  <TableHead className="w-[22%] min-w-[140px]">Total vendido</TableHead>
                  <TableHead className="w-[20%] min-w-[120px]">Cantidad vendida</TableHead>
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
                        <TableCell className="w-12 min-w-12 max-w-12 px-2">
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
                      </TableRow>
                      {isExpanded ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="w-full bg-muted/30 p-0 text-left"
                          >
                            <>
                              <div className="px-4 py-3">
                                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                                  {sortedProducts.slice(0, 8).map((product) => (
                                    <div
                                      key={`${product.name}-${product.variantName ?? "base"}`}
                                      className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-background/35 px-3 py-2 text-xs text-foreground"
                                    >
                                      <span className="min-w-0 wrap-break-word font-medium">
                                        {product.name}
                                        {product.variantName ? ` · ${product.variantName}` : ""}
                                      </span>
                                      <span className="shrink-0 text-right text-muted-foreground">
                                        Cantidad vendida: {product.quantity}
                                      </span>
                                    </div>
                                  ))}
                                </div>
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
                                    className="mt-2 px-2 text-xs"
                                  >
                                    Ver más
                                  </Button>
                                )}
                              </div>
                            </>
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
            <DialogTitle>{productsModalSupplier?.name}</DialogTitle>
            <DialogDescription>Detalle de ventas por producto.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(70vh,32rem)] space-y-1.5 overflow-y-auto">
            {[...(productsModalSupplier?.products ?? [])]
              .filter((product) => product.quantity > 0)
              .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
              .map((product) => (
                <div
                  key={`${product.name}-${product.variantName ?? "base"}`}
                  className="flex items-center justify-between gap-3 rounded-md bg-muted px-3 py-2 text-sm"
                >
                  <span className="min-w-0 wrap-break-word font-medium">
                    {product.name}
                    {product.variantName ? ` · ${product.variantName}` : ""}
                  </span>
                  <span className="shrink-0 text-right text-muted-foreground">
                    Cantidad vendida: {product.quantity}
                  </span>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={supplierDeleteConfirmOpen}
        onOpenChange={(open) => {
          setSupplierDeleteConfirmOpen(open);
          if (!open) {
            setPendingSupplierDelete(null);
          }
        }}
        title="Eliminar proveedores seleccionados?"
        description={
          selectedSupplierDeleteSummary.total > 0
            ? `Se quitarán ${selectedSupplierDeleteSummary.total} referencias vinculadas en productos/variantes antes de borrar el proveedor.`
            : "Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          pendingSupplierDelete?.();
          setPendingSupplierDelete(null);
          setSupplierDeleteConfirmOpen(false);
        }}
      />
    </main>
  );
}
