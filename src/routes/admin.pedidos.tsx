import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Filter,
  Lock,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
  Eye,
  EyeOff,
  Download,
  LoaderCircle,
} from "lucide-react";
import { Sheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { brandList, brands } from "@/config/brands";
import { formatDate, formatPrice } from "@/lib/format";
import { catalogQueries, orderQueries, type Product } from "@/services/catalog.service";
import { cn } from "@/lib/utils";
import { saveOrders, type Order, type OrderAttachment, type OrderStatus } from "@/data/orders";
import { moveToTrash } from "@/data/trash";
import { loadAdminSettings } from "@/server/persistence";

/* eslint-disable no-control-regex */

declare global {
  interface Window {
    __lrg_filtered_orders?: Order[];
    __orders?: Order[];
  }
}

// Export helpers (summary only — no `items` field)
function buildExportRowsFromOrders(ordersList: Order[]) {
  const rows: (string | number)[][] = [
    ["ID", "Fecha", "Cliente", "Email", "Teléfono", "Total", "Estado", "Método de envío"],
  ];
  for (const o of ordersList) {
    rows.push([
      o.id ?? "",
      o.date ?? "",
      o.customer ?? "",
      o.email ?? "",
      o.phone ?? "",
      o.total ?? 0,
      o.status ?? "",
      o.shippingMethod ?? "",
    ]);
  }
  return rows;
}

function exportOrdersExcel(ordersList: Order[]) {
  const rows = buildExportRowsFromOrders(ordersList);
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pedidos");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `pedidos_${date}_filtered.xlsx`);
}

function exportOrdersPdf(ordersList: Order[]) {
  const rows = buildExportRowsFromOrders(ordersList).slice(1);
  const header = [
    "ID",
    "Fecha",
    "Cliente",
    "Email",
    "Teléfono",
    "Total",
    "Estado",
    "Método de envío",
  ];
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
        <h2>Listado de pedidos</h2>
        <table>
          <thead>
            <tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const date = new Date().toISOString().slice(0, 10);
  printWindow.document.title = `pedidos_${date}_filtered`;
  printWindow.document.write(tableHtml);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

// Insert UI buttons into the page header for exporting (Excel + PDF)
if (
  typeof window !== "undefined" &&
  Boolean(
    (window as Window & { __lrg_enable_legacy_export_injection?: boolean })
      .__lrg_enable_legacy_export_injection,
  )
) {
  window.addEventListener("load", () => {
    try {
      // Only inject on pedidos route
      if (!window.location.pathname.includes("/admin/pedidos")) return;

      const header = document.querySelector(".flex.flex-wrap.items-center.gap-2");
      if (!header) return;
      // avoid duplicate buttons
      if (header.querySelector("#lrg-export-pedidos-buttons")) return;

      const container = document.createElement("div");
      container.id = "lrg-export-pedidos-buttons";
      container.className = "relative flex flex-wrap items-center gap-2";

      const svgSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sheet size-4" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="3" x2="21" y1="9" y2="9"></line><line x1="3" x2="21" y1="15" y2="15"></line><line x1="9" x2="9" y1="9" y2="21"></line><line x1="15" x2="15" y1="9" y2="21"></line></svg>`;
      const svgFileText = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text size-4" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`;

      const excelBtnClass =
        "justify-center whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700";
      const pdfBtnClass =
        "justify-center whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700";

      const makeBtn = (label: string, svgMarkup: string, onClick: () => void) => {
        const b = document.createElement("button");
        const isExcel = label.includes("Excel");
        b.className = isExcel ? excelBtnClass : pdfBtnClass;
        b.style.backgroundColor = isExcel ? "#059669" : "#dc2626";
        b.style.color = "#ffffff";
        b.innerHTML = svgMarkup + label;
        b.onclick = onClick;
        return b;
      };

      const excelBtn = makeBtn("Exportar Excel", svgSheet, () => {
        // try to obtain filtered orders from global react query cache if available
        // fallback to window.__orders or empty array
        const dataset = window.__lrg_filtered_orders ?? window.__orders ?? [];
        try {
          exportOrdersExcel(dataset);
        } catch (e) {
          console.error(e);
        }
      });

      const pdfBtn = makeBtn("Exportar PDF", svgFileText, () => {
        const dataset = window.__lrg_filtered_orders ?? window.__orders ?? [];
        try {
          exportOrdersPdf(dataset);
        } catch (e) {
          console.error(e);
        }
      });

      container.appendChild(excelBtn);
      container.appendChild(pdfBtn);
      header.appendChild(container);
    } catch (e) {
      // noop
    }
  });
}

// Ensure buttons appear on SPA navigation: observe DOM and inject when header is added
if (
  typeof window !== "undefined" &&
  Boolean(
    (window as Window & { __lrg_enable_legacy_export_injection?: boolean })
      .__lrg_enable_legacy_export_injection,
  )
) {
  const ensureExportButtons = () => {
    try {
      // Only inject on the pedidos admin route to avoid duplicating buttons on other pages
      if (!window.location.pathname.includes("/admin/pedidos")) return;

      const header = document.querySelector(".flex.flex-wrap.items-center.gap-2");
      if (!header) return;
      if (header.querySelector("#lrg-export-pedidos-buttons")) return;

      const container = document.createElement("div");
      container.id = "lrg-export-pedidos-buttons";
      container.className = "relative flex flex-wrap items-center gap-2";

      const excelBtnClass =
        "justify-center whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700";
      const pdfBtnClass =
        "justify-center whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring h-9 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700";

      const svgSheet = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sheet size-4" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><line x1="3" x2="21" y1="9" y2="9"></line><line x1="3" x2="21" y1="15" y2="15"></line><line x1="9" x2="9" y1="9" y2="21"></line><line x1="15" x2="15" y1="9" y2="21"></line></svg>`;
      const svgFileText = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text size-4" aria-hidden="true"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"></path><path d="M14 2v5a1 1 0 0 0 1 1h5"></path><path d="M10 9H8"></path><path d="M16 13H8"></path><path d="M16 17H8"></path></svg>`;

      const makeBtn = (label: string, svgMarkup: string, onClick: () => void) => {
        const b = document.createElement("button");
        const isExcel = label.includes("Excel");
        b.className = isExcel ? excelBtnClass : pdfBtnClass;
        b.style.backgroundColor = isExcel ? "#059669" : "#dc2626";
        b.style.color = "#ffffff";
        b.innerHTML = svgMarkup + label;
        b.onclick = onClick;
        return b;
      };

      const excelBtn = makeBtn("Exportar Excel", svgSheet, () => {
        const dataset = window.__lrg_filtered_orders ?? window.__orders ?? [];
        try {
          exportOrdersExcel(dataset);
        } catch (e) {
          console.error(e);
        }
      });

      const pdfBtn = makeBtn("Exportar PDF", svgFileText, () => {
        const dataset = window.__lrg_filtered_orders ?? window.__orders ?? [];
        try {
          exportOrdersPdf(dataset);
        } catch (e) {
          console.error(e);
        }
      });

      container.appendChild(excelBtn);
      container.appendChild(pdfBtn);
      header.appendChild(container);
    } catch (e) {
      // noop
    }
  };

  // run now in case header already present
  setTimeout(ensureExportButtons, 150);

  const mo = new MutationObserver(() => ensureExportButtons());
  mo.observe(document.body, { childList: true, subtree: true });
}
import { orders as ordersData } from "@/data/orders";
import type { BrandSlug } from "@/config/brands";

const statuses: (OrderStatus | "todos")[] = [
  "todos",
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
];

const brandsFilter: (BrandSlug | "todos")[] = ["todos", "arcade", "scents", "web-design"];

const defaultShippingMethods = ["Físico", "Digital", "WhatsApp"];
const defaultPaymentMethods = [
  "Transferencia bancaria",
  "Tarjeta de crédito",
  "Tarjeta de débito",
  "Efectivo",
  "MercadoPago",
];

const toggleFilterSelection = (
  selected: string[],
  value: string,
  checked: boolean,
  availableValues: string[],
) => {
  if (value === "todos") return [];
  const next = checked
    ? Array.from(new Set([...selected, value]))
    : selected.filter((item) => item !== value);
  return availableValues.length > 0 && availableValues.every((item) => next.includes(item))
    ? []
    : next;
};

const getConfiguredMethodNames = (storageKey: string, fallback: string[]) => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);

    const methods = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed as Record<string, unknown>).flatMap((brandConfig) => {
          if (Array.isArray(brandConfig)) return brandConfig;
          if (brandConfig && typeof brandConfig === "object") {
            const configuredMethods = (brandConfig as { methods?: unknown }).methods;
            return Array.isArray(configuredMethods) ? configuredMethods : [];
          }
          return [];
        });

    const configured = methods
      .filter((item): item is { enabled?: boolean; name?: unknown } =>
        Boolean(item && typeof item === "object" && "enabled" in item),
      )
      .filter((item) => item.enabled)
      .map((item) => (item.name ? String(item.name) : String(item)))
      .filter(Boolean);

    const uniqueConfigured = Array.from(new Set(configured));
    return uniqueConfigured.length > 0 ? uniqueConfigured : fallback;
  } catch {
    return fallback;
  }
};

const normalizeShippingMethod = (method?: string) =>
  method
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[ -]/g, (char) => char) ?? "";

const isPhysicalShippingMethod = (method?: string) =>
  !!method &&
  method
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .includes("fisico");

const isShippingCodeRequiredForBrand = (brandSlug: BrandSlug, shippingMethod?: string) => {
  if (!shippingMethod) return false;
  const shipping = brands[brandSlug]?.shipping;
  if (!shipping?.methods?.length) return false;

  const normalizedTarget = normalizeShippingMethod(shippingMethod);
  return shipping.methods.some(
    (method) => method.codeRequired && normalizeShippingMethod(method.name) === normalizedTarget,
  );
};

type OrderSort =
  | "customer_asc"
  | "customer_desc"
  | "date_desc"
  | "date_asc"
  | "total_desc"
  | "total_asc"
  | "profit_asc"
  | "profit_desc";

type DeliveryStatus = "Pendiente" | "Enviado";
type PaymentStatus = "Pendiente" | "Pagado" | "Cancelado";

type EditableOrderItem = {
  productId?: string;
  variantId?: string;
  variantName?: string;
  name: string;
  quantity: number;
  originalName: string | undefined;
  originalQuantity: number | undefined;
  price: number;
  priceCurrency?: "ARS" | "USD";
  gastos?: number;
  gastosCurrency?: "ARS" | "USD";
  usdRate?: number;
  stock: number | undefined;
  confirmed: boolean;
  brand?: BrandSlug;
  paymentMethod?: string;
  shippingMethod?: string;
  shippingNumber?: string;
  paymentStatus?: PaymentStatus;
  deliveryStatus?: DeliveryStatus;
  supplier?: { name: string; phone: string; social: string };
};

type EditableOrder = Omit<Order, "items"> & {
  items: EditableOrderItem[];
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
  shippingNumber?: string | undefined;
  shippingMethod?:
    "Por correo fisico" | "Por correo electronico" | "Por Whatsapp" | string | undefined;
  deliveryDate?: string | undefined;
};

function computeOrderTotals(items: EditableOrderItem[], expenseRatio = 0.65) {
  const total = items.reduce((sum, item) => {
    if (!item.name?.trim() || item.quantity < 1) return sum;
    return sum + item.price * item.quantity;
  }, 0);

  const expenses = Math.round(total * expenseRatio);
  return {
    total,
    expenses,
    profit: total - expenses,
  };
}

const statusVariant: Record<
  OrderStatus,
  "default" | "secondary" | "destructive" | "success" | "warning" | "outline" | "pending"
> = {
  pendiente: "outline",
  pagado: "success",
  enviado: "warning",
  entregado: "default",
  cancelado: "destructive",
};

const deliveryVariant: Record<"Pendiente" | "Enviado", "pending" | "warning"> = {
  Pendiente: "pending",
  Enviado: "warning",
};

const paymentVariant: Record<
  "Pendiente" | "Pagado" | "Cancelado",
  "pending" | "success" | "destructive"
> = {
  Pendiente: "pending",
  Pagado: "success",
  Cancelado: "destructive",
};

const getDeliveryStatus = (status: OrderStatus): DeliveryStatus =>
  status === "enviado" || status === "entregado" ? "Enviado" : "Pendiente";

const getPaymentStatus = (status: OrderStatus): PaymentStatus => {
  if (status === "pagado") return "Pagado";
  if (status === "cancelado") return "Cancelado";
  return "Pendiente";
};

const mergeOrderStatus = (
  deliveryStatus: DeliveryStatus,
  paymentStatus: PaymentStatus,
): OrderStatus => {
  if (paymentStatus === "Cancelado") return "cancelado";
  if (paymentStatus === "Pagado") return "pagado";
  if (deliveryStatus === "Enviado") return "enviado";
  return "pendiente";
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const searchSchema = z.object({ pedido: z.string().optional() });

export const Route = createFileRoute("/admin/pedidos")({
  validateSearch: searchSchema,
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  head: () => ({
    meta: [
      { title: "Administrador" },
      {
        name: "description",
        content: "Seguimiento de pedidos de los tres sectores con estados y detalle de items.",
      },
      { property: "og:title", content: "Administrador" },
      { property: "og:description", content: "Gestión de pedidos del negocio LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrders,
});

function AdminOrders() {
  const search = Route.useSearch();
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const { data: allProducts } = useSuspenseQuery(catalogQueries.all());
  const queryClient = useQueryClient();
  const [editableOrders, setEditableOrders] = useState<typeof orders>(() => orders);
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryStatus[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus[]>([]);
  const [shippingMethodFilter, setShippingMethodFilter] = useState<string[]>([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([]);
  const [brand, setBrand] = useState<BrandSlug[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<Array<"ARS" | "USD">>(["ARS", "USD"]);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [quantityMin, setQuantityMin] = useState(0);
  const [quantityMax, setQuantityMax] = useState(0);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<OrderSort | null>("date_desc");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageSizeInput, setPageSizeInput] = useState<string>("10");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkOrderEditQueue, setBulkOrderEditQueue] = useState<string[]>([]);
  const [bulkQuickEditOrderQueue, setBulkQuickEditOrderQueue] = useState<string[]>([]);
  const [bulkOrderEditPosition, setBulkOrderEditPosition] = useState(0);
  const [documentsOrder, setDocumentsOrder] = useState<Order | null>(null);
  const [receiptsOrder, setReceiptsOrder] = useState<Order | null>(null);
  const [productListModalOrder, setProductListModalOrder] = useState<Order | null>(null);
  const [pendingOrderItemDeleteIndex, setPendingOrderItemDeleteIndex] = useState<number | null>(
    null,
  );
  const [pendingAttachments, setPendingAttachments] = useState<OrderAttachment[]>([]);
  const [isSavingDocuments, setIsSavingDocuments] = useState(false);
  const documentsInputRef = useRef<HTMLInputElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deliveryFilterOpen, setDeliveryFilterOpen] = useState(false);
  const [paymentFilterOpen, setPaymentFilterOpen] = useState(false);
  const [shippingFilterOpen, setShippingFilterOpen] = useState(false);
  const [paymentMethodFilterOpen, setPaymentMethodFilterOpen] = useState(false);
  const [brandFilterOpen, setBrandFilterOpen] = useState(false);
  const [priceFilterOpen, setPriceFilterOpen] = useState(false);
  const [quantityFilterOpen, setQuantityFilterOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const [orderForm, setOrderForm] = useState<EditableOrder | null>(null);
  const [selectedOrderStore, setSelectedOrderStore] = useState<BrandSlug>("arcade");
  const initialOrderFormSnapshot = useRef<string | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [paymentInstruction, setPaymentInstruction] = useState<string>("");
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description?: string | undefined;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }>({ open: false, title: "", onConfirm: () => {} });

  const [quickEditOrderId, setQuickEditOrderId] = useState<string | null>(null);
  const [quickEditOrderForm, setQuickEditOrderForm] = useState<
    Record<
      string,
      {
        deliveryStatus: DeliveryStatus;
        paymentStatus: PaymentStatus;
        shippingMethod: string;
        shippingNumber: string;
        paymentMethod: string;
        deliveryDate: string;
      }
    >
  >({});
  const [isBulkQuickEditing, setIsBulkQuickEditing] = useState(false);
  const quickEditRowRef = useRef<HTMLTableRowElement | null>(null);
  const quickEditDetailRef = useRef<HTMLTableRowElement | null>(null);
  const quickEditOriginalSnapshots = useRef<Record<string, string>>({});
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

  const startQuickEditOrder = (order: Order, bulk = false) => {
    const draft = {
      deliveryStatus:
        (order as Order & { deliveryStatus?: DeliveryStatus }).deliveryStatus ??
        getDeliveryStatus(order.status),
      paymentStatus:
        (order as Order & { paymentStatus?: PaymentStatus }).paymentStatus ??
        getPaymentStatus(order.status),
      shippingMethod: order.shippingMethod ?? "",
      shippingNumber: order.shippingNumber ?? "",
      paymentMethod: order.paymentMethod,
      deliveryDate: order.deliveryDate ?? "",
    };
    setIsBulkQuickEditing(bulk);
    setExpandedOrderId(bulk ? null : order.id);
    setQuickEditOrderId(order.id);
    quickEditOriginalSnapshots.current[order.id] = JSON.stringify(draft);
    setQuickEditOrderForm((current) => ({
      ...current,
      [order.id]: draft,
    }));
  };

  const cancelQuickEditOrder = useCallback(() => {
    const currentOrderId = quickEditOrderId;
    const remainingQueue = bulkQuickEditOrderQueue.filter((orderId) => orderId !== currentOrderId);
    const nextQueuedOrderId = remainingQueue[0];
    const nextQuickEditOrder = nextQueuedOrderId
      ? editableOrders.find((order) => order.id === nextQueuedOrderId)
      : null;

    setBulkQuickEditOrderQueue(remainingQueue);
    setQuickEditOrderId(null);
    setQuickEditOrderForm((current) => {
      const next = { ...current };
      if (currentOrderId) {
        delete next[currentOrderId];
        delete quickEditOriginalSnapshots.current[currentOrderId];
      }
      return next;
    });

    if (nextQuickEditOrder) {
      setSelectionMode(true);
      startQuickEditOrder(nextQuickEditOrder, isBulkQuickEditing);
      return;
    }

    setIsBulkQuickEditing(false);
    setSelectionMode(selectedOrderIds.length > 0);
  }, [
    bulkQuickEditOrderQueue,
    editableOrders,
    isBulkQuickEditing,
    quickEditOrderId,
    selectedOrderIds.length,
  ]);

  const cancelQuickEditSession = useCallback(() => {
    const currentOrderId = quickEditOrderId;
    setQuickEditOrderId(null);
    setQuickEditOrderForm((current) => {
      const next = { ...current };
      if (currentOrderId) {
        delete next[currentOrderId];
        delete quickEditOriginalSnapshots.current[currentOrderId];
      }
      return next;
    });
    setBulkQuickEditOrderQueue([]);
    setIsBulkQuickEditing(false);
    setExpandedOrderId(null);
    setSelectionMode(false);
    setSelectedOrderIds([]);
  }, [quickEditOrderId]);

  const saveQuickEditOrder = async (order: Order) => {
    const draft = quickEditOrderForm[order.id];
    if (!draft) return;

    const nextStatus = mergeOrderStatus(draft.deliveryStatus, draft.paymentStatus);
    const wasCanceled = order.status === "cancelado";
    const willCancel = nextStatus === "cancelado" && !wasCanceled;
    const willRestore = nextStatus !== "cancelado" && wasCanceled;

    if (willCancel) {
      await import("@/services/catalog.service").then(({ adjustProductStockForOrder }) =>
        adjustProductStockForOrder(order, 1),
      );
    }
    if (willRestore) {
      await import("@/services/catalog.service").then(({ adjustProductStockForOrder }) =>
        adjustProductStockForOrder(order, -1),
      );
    }

    setEditableOrders((currentOrders) => {
      const nextOrders = currentOrders.map((currentOrder) =>
        currentOrder.id === order.id
          ? {
              ...currentOrder,
              deliveryStatus: draft.deliveryStatus,
              paymentStatus: draft.paymentStatus,
              shippingMethod: draft.shippingMethod || undefined,
              paymentMethod: draft.paymentMethod,
              deliveryDate: draft.deliveryDate || undefined,
              status: nextStatus,
            }
          : currentOrder,
      );
      saveOrders(nextOrders);
      return nextOrders;
    });

    const currentOrderId = order.id;
    const remainingQueue = bulkQuickEditOrderQueue.filter((orderId) => orderId !== currentOrderId);
    const nextQueuedOrderId = remainingQueue[0];
    setBulkQuickEditOrderQueue(remainingQueue);
    setQuickEditOrderId(null);
    setQuickEditOrderForm((current) => {
      const next = { ...current };
      delete next[order.id];
      delete quickEditOriginalSnapshots.current[order.id];
      return next;
    });

    if (nextQueuedOrderId) {
      const nextQuickEditOrder = editableOrders.find((candidate) => candidate.id === nextQueuedOrderId);
      if (nextQuickEditOrder) {
        setSelectionMode(true);
        startQuickEditOrder(nextQuickEditOrder, isBulkQuickEditing);
        return;
      }
    }

    setIsBulkQuickEditing(false);
    setSelectionMode(selectedOrderIds.length > 0);
  };

  const addDocuments = async (files: FileList | null) => {
    if (!files || !documentsOrder) return;
    const attachments = await Promise.all(
      Array.from(files).map(
        (file) =>
          new Promise<OrderAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                dataUrl: String(reader.result),
              });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
      ),
    );
    setPendingAttachments((current) => [...current, ...attachments]);
  };

  const cancelDocuments = () => {
    setPendingAttachments([]);
    setDocumentsOrder(null);
  };

  const saveDocuments = async () => {
    if (!documentsOrder || pendingAttachments.length === 0) return;
    const attachmentCount = pendingAttachments.length;
    setIsSavingDocuments(true);
    try {
      const next = editableOrders.map((order) =>
        order.id === documentsOrder.id
          ? { ...order, attachments: [...(order.attachments ?? []), ...pendingAttachments] }
          : order,
      );
      await saveOrders(next);
      setEditableOrders(next);
      queryClient.setQueryData(orderQueries.list().queryKey, next);
      setDocumentsOrder(next.find((order) => order.id === documentsOrder.id) ?? null);
      setPendingAttachments([]);
      toast.success(
        `Se guardó ${attachmentCount} archivo adjunto${attachmentCount === 1 ? "" : "s"}.`,
      );
    } catch {
      toast.error("No se pudieron guardar los archivos adjuntos.");
    } finally {
      setIsSavingDocuments(false);
    }
  };

  const removeDocument = (attachmentName: string) => {
    if (!documentsOrder) return;
    setEditableOrders((current) => {
      const next = current.map((order) =>
        order.id === documentsOrder.id
          ? {
              ...order,
              attachments: (order.attachments ?? []).filter(
                (attachment) => attachment.name !== attachmentName,
              ),
            }
          : order,
      );
      saveOrders(next);
      queryClient.setQueryData(orderQueries.list().queryKey, next);
      setDocumentsOrder(next.find((order) => order.id === documentsOrder.id) ?? null);
      return next;
    });
  };

  useEffect(() => {
    if (!quickEditOrderId || isBulkQuickEditing) return;

    setExpandedOrderId(quickEditOrderId);
    const frame = requestAnimationFrame(() => {
      quickEditDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideRow = quickEditRowRef.current?.contains(target);
      const isInsideDetail = quickEditDetailRef.current?.contains(target);
      const isInsideSelectPortal = !!(target as Element)?.closest?.(
        "[data-radix-popper-content-wrapper]",
      );

      if (!isInsideRow && !isInsideDetail && !isInsideSelectPortal) {
        cancelQuickEditOrder();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [cancelQuickEditOrder, isBulkQuickEditing, quickEditOrderForm, quickEditOrderId]);

  useEffect(() => {
    if (!expandedOrderId || quickEditOrderId || isBulkQuickEditing) return;

    const frame = requestAnimationFrame(() => {
      quickEditDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => cancelAnimationFrame(frame);
  }, [expandedOrderId, isBulkQuickEditing, quickEditOrderId]);

  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<string[]>([]);
  const [availableShippingMethods, setAvailableShippingMethods] = useState<string[]>([]);
  const [availablePaymentMethodsByBrand, setAvailablePaymentMethodsByBrand] = useState<
    Record<BrandSlug, string[]>
  >({ arcade: [], scents: [], "web-design": [] });
  const [availableShippingMethodsByBrand, setAvailableShippingMethodsByBrand] = useState<
    Record<BrandSlug, string[]>
  >({ arcade: [], scents: [], "web-design": [] });

  useEffect(() => {
    void loadAdminSettings({ data: {} }).then((settings) => {
      const fallbackByBrand: Record<BrandSlug, string[]> = {
        arcade: defaultPaymentMethods,
        scents: defaultPaymentMethods,
        "web-design": defaultPaymentMethods,
      };
      const fallbackShippingByBrand: Record<BrandSlug, string[]> = {
        arcade: defaultShippingMethods,
        scents: defaultShippingMethods,
        "web-design": defaultShippingMethods,
      };
      const readConfiguredMethodsByBrand = (
        settingKey: string,
        fallback: Record<BrandSlug, string[]>,
      ) => {
        const setting = settings.find((item) => item.settingKey === settingKey);
        if (!setting) return fallback;
        try {
          const parsed = JSON.parse(setting.settingValue) as unknown;
          const readNames = (values: unknown) =>
            (Array.isArray(values) ? values : [])
              .filter((value) => value && typeof value === "object")
              .filter((value) => (value as { enabled?: boolean }).enabled !== false)
              .map((value) => String((value as { name?: unknown }).name ?? ""))
              .filter(Boolean);

          if (Array.isArray(parsed)) {
            const names = readNames(parsed);
            return Object.fromEntries(
              brandList.map((brand) => [brand.slug, names.length ? names : fallback[brand.slug]]),
            ) as Record<BrandSlug, string[]>;
          }

          const parsedByBrand = parsed as Record<string, unknown>;
          return Object.fromEntries(
            brandList.map((brand) => {
              const brandConfig = parsedByBrand[brand.slug];
              const values = Array.isArray(brandConfig)
                ? brandConfig
                : brandConfig && typeof brandConfig === "object"
                  ? (brandConfig as { methods?: unknown }).methods
                  : [];
              const names = readNames(values);
              return [brand.slug, names.length ? Array.from(new Set(names)) : fallback[brand.slug]];
            }),
          ) as Record<BrandSlug, string[]>;
        } catch {
          return fallback;
        }
      };
      const paymentMethodsByBrand = readConfiguredMethodsByBrand(
        "lrg:paymentMethods",
        fallbackByBrand,
      );
      const shippingMethodsByBrand = readConfiguredMethodsByBrand(
        "lrg:shippingMethods",
        fallbackShippingByBrand,
      );
      setAvailablePaymentMethodsByBrand(paymentMethodsByBrand);
      setAvailableShippingMethodsByBrand(shippingMethodsByBrand);
      setAvailablePaymentMethods(Array.from(new Set(Object.values(paymentMethodsByBrand).flat())));
      setAvailableShippingMethods(Array.from(new Set(Object.values(shippingMethodsByBrand).flat())));
    });
  }, []);

  const getQuickEditOptions = (available: string[], value?: string) => {
    const options = [...available];
    if (value && !options.includes(value)) {
      options.push(value);
    }
    return options;
  };

  const quickEditPaymentMethodOptions = useMemo(() => {
    const draft = quickEditOrderId ? quickEditOrderForm[quickEditOrderId] : undefined;
    return getQuickEditOptions(availablePaymentMethods, draft?.paymentMethod);
  }, [availablePaymentMethods, quickEditOrderForm, quickEditOrderId]);

  const quickEditShippingMethodOptions = useMemo(() => {
    const draft = quickEditOrderId ? quickEditOrderForm[quickEditOrderId] : undefined;
    return getQuickEditOptions(availableShippingMethods, draft?.shippingMethod);
  }, [availableShippingMethods, quickEditOrderForm, quickEditOrderId]);

  useEffect(() => {
    setEditableOrders(orders);
  }, [orders]);

  const paymentMethodOptions = useMemo(() => {
    const options = [
      ...(orderForm ? availablePaymentMethodsByBrand[orderForm.brand] ?? [] : availablePaymentMethods),
    ];
    if (orderForm?.paymentMethod && !options.includes(orderForm.paymentMethod)) {
      options.push(orderForm.paymentMethod);
    }
    return Array.from(new Set(options));
  }, [availablePaymentMethods, availablePaymentMethodsByBrand, orderForm?.brand, orderForm?.paymentMethod]);

  const orderStoreSlugs = useMemo(
    () =>
      orderForm
        ? Array.from(new Set(orderForm.items.map((item) => item.brand ?? orderForm.brand)))
        : [],
    [orderForm],
  );

  const getItemStore = (item: EditableOrderItem) => item.brand ?? orderForm?.brand ?? "arcade";

  const getStoreItems = (items: EditableOrderItem[], store: BrandSlug) =>
    items.filter((item) => getItemStore(item) === store);

  const getBrandDisplayName = useCallback((brandSlug?: BrandSlug) => {
    const brandName = brandSlug ? brands[brandSlug]?.shortName ?? brands[brandSlug]?.name : "";
    return brandName.replace(/^LRG\s+/i, "").trim();
  }, []);

  const getBrandFullName = useCallback((brandSlug?: BrandSlug) => {
    if (!brandSlug) return "Sin tienda";
    return brands[brandSlug]?.name ?? brandSlug;
  }, []);

  const getStoreFormValues = (items: EditableOrderItem[], store: BrandSlug) => {
    const storeItems = getStoreItems(items, store);
    const firstItem = storeItems[0];
    return {
      paymentMethod: firstItem?.paymentMethod ?? "",
      paymentStatus: firstItem?.paymentStatus ?? "Pendiente",
      shippingMethod: firstItem?.shippingMethod ?? "",
      deliveryStatus: firstItem?.deliveryStatus ?? "Pendiente",
    };
  };

  const applySelectedStoreValues = (form: EditableOrder, store: BrandSlug) => {
    const storeItems = getStoreItems(form.items, store);
    return {
      ...getStoreFormValues(form.items, store),
      paymentMethod:
        storeItems[0]?.paymentMethod ??
        (store === form.brand ? form.paymentMethod : ""),
      paymentStatus:
        storeItems[0]?.paymentStatus ??
        (store === form.brand ? form.paymentStatus : "Pendiente"),
      shippingMethod:
        storeItems[0]?.shippingMethod ??
        (store === form.brand ? form.shippingMethod ?? "" : ""),
      deliveryStatus:
        storeItems[0]?.deliveryStatus ??
        (store === form.brand ? form.deliveryStatus : "Pendiente"),
    };
  };

  const saveSelectedStoreValues = (form: EditableOrder, store: BrandSlug) => ({
    ...form,
    brand: store,
    items: form.items.map((item) =>
      getItemStore(item) === store
        ? {
            ...item,
            brand: store,
            paymentMethod: form.paymentMethod,
            paymentStatus: form.paymentStatus,
            shippingMethod: form.shippingMethod,
            deliveryStatus: form.deliveryStatus,
          }
        : item,
    ),
  });

  const shippingMethodOptions = useMemo(() => {
    const options = [
      ...(orderForm
        ? availableShippingMethodsByBrand[orderForm.brand] ?? []
        : availableShippingMethods),
    ];
    if (orderForm?.shippingMethod && !options.includes(orderForm.shippingMethod)) {
      options.push(orderForm.shippingMethod);
    }
    return Array.from(new Set(options));
  }, [
    availableShippingMethods,
    availableShippingMethodsByBrand,
    orderForm?.brand,
    orderForm?.shippingMethod,
  ]);

  const getOrderCurrencies = useCallback(
    (order: Order) =>
      new Set(
        order.items.map(
          (item) =>
            allProducts.find((product) => product.name === item.name)?.priceCurrency ?? "ARS",
        ),
      ),
    [allProducts],
  );

  const priceLimit = useMemo(() => {
    const values = editableOrders
      .filter(
        (order) =>
          !currencyFilter.length ||
          [...getOrderCurrencies(order)].some((currency) =>
            currencyFilter.includes(currency as "ARS" | "USD"),
          ),
      )
      .map((order) => order.total);
    return Math.max(1, Math.ceil(Math.max(0, ...values) / 50) * 50);
  }, [editableOrders, currencyFilter, getOrderCurrencies]);

  const quantityLimit = useMemo(
    () =>
      Math.max(
        1,
        ...editableOrders.map((order) => order.items.reduce((sum, item) => sum + item.quantity, 0)),
      ),
    [editableOrders],
  );

  useEffect(() => {
    setPriceMin(0);
    setPriceMax(priceLimit);
  }, [currencyFilter, priceLimit]);

  useEffect(() => {
    setQuantityMin(0);
    setQuantityMax(quantityLimit);
  }, [quantityLimit]);

  const results = useMemo(() => {
    const filtered = editableOrders.filter((order) => {
      const orderDeliveryStatus =
        (order as Order & { deliveryStatus?: DeliveryStatus }).deliveryStatus ??
        getDeliveryStatus(order.status);
      const orderPaymentStatus =
        (order as Order & { paymentStatus?: PaymentStatus }).paymentStatus ??
        getPaymentStatus(order.status);
      const deliveryMatches =
        !deliveryFilter.length || deliveryFilter.includes(orderDeliveryStatus);
      const paymentMatches = !paymentFilter.length || paymentFilter.includes(orderPaymentStatus);
      const brandMatches = !brand.length || brand.includes(order.brand);
      const shippingMatches =
        !shippingMethodFilter.length || shippingMethodFilter.includes(order.shippingMethod ?? "");
      const paymentMethodMatches =
        !paymentMethodFilter.length || paymentMethodFilter.includes(order.paymentMethod ?? "");
      const currencyMatches =
        !currencyFilter.length ||
        [...getOrderCurrencies(order)].some((currency) =>
          currencyFilter.includes(currency as "ARS" | "USD"),
        );
      const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const priceMatches = order.total >= priceMin && order.total <= priceMax;
      const quantityMatches = quantity >= quantityMin && quantity <= quantityMax;
      const queryMatches =
        !query ||
        order.id.toLowerCase().includes(query.toLowerCase()) ||
        order.customer.toLowerCase().includes(query.toLowerCase()) ||
        order.email.toLowerCase().includes(query.toLowerCase());

      return (
        deliveryMatches &&
        paymentMatches &&
        brandMatches &&
        queryMatches &&
        shippingMatches &&
        paymentMethodMatches &&
        currencyMatches &&
        priceMatches &&
        quantityMatches
      );
    });

    if (!sortOrder) {
      return [...filtered];
    }

    return [...filtered].sort((a, b) => {
      switch (sortOrder) {
        case "customer_asc":
          return a.customer.localeCompare(b.customer);
        case "customer_desc":
          return b.customer.localeCompare(a.customer);
        case "date_desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "date_asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "total_desc":
          return b.total - a.total;
        case "total_asc":
          return a.total - b.total;
        case "profit_asc":
          return a.profit - b.profit;
        case "profit_desc":
          return b.profit - a.profit;
        default:
          return 0;
      }
    });
  }, [
    editableOrders,
    deliveryFilter,
    paymentFilter,
    shippingMethodFilter,
    paymentMethodFilter,
    brand,
    currencyFilter,
    priceMin,
    priceMax,
    quantityMin,
    quantityMax,
    query,
    sortOrder,
    getOrderCurrencies,
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
  const visibleOrderIds = visibleResults.map((order) => order.id);
  const hasExpandedOrder = expandedOrderId !== null;
  const selectedVisibleOrderIds = visibleOrderIds.filter((id) => selectedOrderIds.includes(id));
  const allVisibleOrdersSelected =
    visibleOrderIds.length > 0 && selectedVisibleOrderIds.length === visibleOrderIds.length;
  const someVisibleOrdersSelected = selectedVisibleOrderIds.length > 0 && !allVisibleOrdersSelected;

  useEffect(() => {
    if (!search.pedido || !pageSize || pageSize <= 0) return;
    const orderIndex = results.findIndex((order) => order.id === search.pedido);
    if (orderIndex < 0) return;

    setPage(Math.floor(orderIndex / pageSize));
  }, [search.pedido, results, pageSize]);

  useEffect(() => {
    if (!search.pedido || !visibleResults.some((order) => order.id === search.pedido)) return;

    setHighlightedOrderId(search.pedido);
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`pedido-${search.pedido}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
    const timeout = window.setTimeout(() => {
      setHighlightedOrderId(null);
      if (search.pedido) {
        setExpandedOrderId(search.pedido);
      }
    }, 2600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [search.pedido, visibleResults]);
  const totalPages =
    pageSize && pageSize > 0 ? Math.max(1, Math.ceil(results.length / pageSize)) : 1;
  const hasNextPage = page + 1 < totalPages;
  const hasPreviousPage = page > 0;
  const activeFilterCount =
    deliveryFilter.length +
    paymentFilter.length +
    shippingMethodFilter.length +
    paymentMethodFilter.length +
    brand.length +
    (currencyFilter.length === 1 ? 1 : 0) +
    (priceMin > 0 ? 1 : 0) +
    (priceMax < priceLimit ? 1 : 0) +
    (quantityMin > 0 ? 1 : 0) +
    (quantityMax < quantityLimit ? 1 : 0);

  const resetFilters = () => {
    setDeliveryFilter([]);
    setPaymentFilter([]);
    setShippingMethodFilter([]);
    setPaymentMethodFilter([]);
    setBrand([]);
    setCurrencyFilter(["ARS", "USD"]);
    setPriceMin(0);
    setPriceMax(priceLimit);
    setQuantityMin(0);
    setQuantityMax(quantityLimit);
  };
  const priceCurrencyLabel =
    currencyFilter.includes("ARS") && currencyFilter.includes("USD")
      ? "$/USD"
      : currencyFilter.includes("USD")
        ? "USD"
        : "$";
  const filterSections: Array<{
    label: string;
    open: boolean;
    setOpen: (value: (current: boolean) => boolean) => void;
    selected: string[];
    setSelected: (value: string, checked: boolean) => void;
    options: Array<{ value: string; label: string }>;
  }> = [
    {
      label: "Tiendas",
      open: brandFilterOpen,
      setOpen: setBrandFilterOpen,
      selected: brand,
      setSelected: (value, checked) =>
        setBrand(
          (current) =>
            toggleFilterSelection(
              current,
              value,
              checked,
              brandsFilter.filter((item) => item !== "todos"),
            ) as BrandSlug[],
        ),
      options: brandsFilter
        .filter((item) => item !== "todos")
        .map((item) => ({ value: item, label: brands[item].name })),
    },
    {
      label: "Estado de entrega",
      open: deliveryFilterOpen,
      setOpen: setDeliveryFilterOpen,
      selected: deliveryFilter,
      setSelected: (value, checked) =>
        setDeliveryFilter(
          (current) =>
            toggleFilterSelection(current, value, checked, [
              "Pendiente",
              "Enviado",
            ]) as DeliveryStatus[],
        ),
      options: (["Pendiente", "Enviado"] as DeliveryStatus[]).map((item) => ({
        value: item,
        label: item,
      })),
    },
    {
      label: "Estado de pago",
      open: paymentFilterOpen,
      setOpen: setPaymentFilterOpen,
      selected: paymentFilter,
      setSelected: (value, checked) =>
        setPaymentFilter(
          (current) =>
            toggleFilterSelection(current, value, checked, [
              "Pendiente",
              "Pagado",
              "Cancelado",
            ]) as PaymentStatus[],
        ),
      options: (["Pendiente", "Pagado", "Cancelado"] as PaymentStatus[]).map((item) => ({
        value: item,
        label: item,
      })),
    },
    {
      label: "Métodos de envío",
      open: shippingFilterOpen,
      setOpen: setShippingFilterOpen,
      selected: shippingMethodFilter,
      setSelected: (value, checked) =>
        setShippingMethodFilter((current) =>
          toggleFilterSelection(current, value, checked, availableShippingMethods),
        ),
      options: availableShippingMethods.map((item) => ({ value: item, label: item })),
    },
    {
      label: "Métodos de pago",
      open: paymentMethodFilterOpen,
      setOpen: setPaymentMethodFilterOpen,
      selected: paymentMethodFilter,
      setSelected: (value, checked) =>
        setPaymentMethodFilter((current) =>
          toggleFilterSelection(current, value, checked, availablePaymentMethods),
        ),
      options: availablePaymentMethods.map((item) => ({ value: item, label: item })),
    },
  ];

  const openEditOrderDialog = (order: Order) => {
    const expenseRatio = order.total ? order.expenses / order.total : 0.65;
    const cloned: EditableOrder = {
      ...order,
      items: order.items.map((item) => {
        const productMatch = allProducts.find((product) => product.name === item.name);
        return {
          ...item,
          brand: item.brand ?? productMatch?.brand ?? order.brand,
          originalName: item.name,
          originalQuantity: item.quantity,
          stock: productMatch?.stockUnlimited
            ? undefined
            : productMatch
              ? Math.max(productMatch.stock, item.quantity)
              : undefined,
          confirmed: true,
          paymentMethod: item.paymentMethod ?? order.paymentMethod,
          shippingMethod: item.shippingMethod ?? order.shippingMethod,
          paymentStatus: item.paymentStatus ?? getPaymentStatus(order.status),
          deliveryStatus: item.deliveryStatus ?? getDeliveryStatus(order.status),
          supplier: getSupplierForItem(item.name, item.productId, item.variantId)?.supplier
            ? {
                name:
                  getSupplierForItem(item.name, item.productId, item.variantId)?.supplier?.name ??
                  "",
                phone:
                  getSupplierForItem(item.name, item.productId, item.variantId)?.supplier?.phone ??
                  "",
                social:
                  getSupplierForItem(item.name, item.productId, item.variantId)?.supplier?.social ??
                  "",
              }
            : undefined,
        };
      }),
      deliveryStatus:
        (order as Order & { deliveryStatus?: DeliveryStatus }).deliveryStatus ??
        getDeliveryStatus(order.status),
      paymentStatus:
        (order as Order & { paymentStatus?: PaymentStatus }).paymentStatus ??
        getPaymentStatus(order.status),
      shippingNumber: order.shippingNumber ?? undefined,
      shippingMethod: (order as Order & { shippingMethod?: string }).shippingMethod ?? undefined,
      deliveryDate: (order as Order & { deliveryDate?: string }).deliveryDate ?? undefined,
    };
    const totals = computeOrderTotals(cloned.items, expenseRatio);
    cloned.total = totals.total;
    cloned.expenses = totals.expenses;
    cloned.profit = totals.profit;
    const firstStore = cloned.items[0]?.brand ?? cloned.brand;
    setSelectedOrderStore(firstStore);
    const selectedStoreValues = applySelectedStoreValues(cloned, firstStore);
    cloned.paymentMethod = selectedStoreValues.paymentMethod;
    cloned.paymentStatus = selectedStoreValues.paymentStatus;
    cloned.shippingMethod = selectedStoreValues.shippingMethod;
    cloned.deliveryStatus = selectedStoreValues.deliveryStatus;
    initialOrderFormSnapshot.current = JSON.stringify(cloned);
    setOrderForm(cloned);
    setIsCreatingOrder(false);
    setPaymentInstruction("");
    setDialogOpen(true);
  };

  const openNewOrderDialog = () => {
    const newOrder: EditableOrder = {
      id: `LRG-${Date.now()}`,
      brand: "arcade",
      customer: "",
      email: "",
      phone: "",
      extraInfo: "",
      date: "",
      total: 0,
      expenses: 0,
      profit: 0,
      status: "pendiente",
      deliveryStatus: "" as DeliveryStatus,
      paymentStatus: "" as PaymentStatus,
      paymentMethod: "",
      shippingMethod: "",
      items: [],
    };
    setSelectedOrderStore(newOrder.brand);
    initialOrderFormSnapshot.current = JSON.stringify(newOrder);
    setOrderForm(newOrder);
    setIsCreatingOrder(true);
    setPaymentInstruction("");
    setDialogOpen(true);
  };

  const clampQuantity = (item: EditableOrderItem, quantity: number) => {
    if (item.stock === undefined) return Math.max(1, quantity);
    return Math.min(Math.max(1, quantity), item.stock);
  };

  const getPaymentInstruction = (from: string, to: string) => {
    if (from === to) return "";
    if (to === "Transferencia") return "Enviar al cliente CBU o alias.";
    if (to === "Efectivo") return "Enviar al cliente el código de acreditación.";
    if (to === "Tarjeta" || to === "Mercado Pago")
      return "Enviar al cliente un link de pago para abonar el pago.";
    return "";
  };

  const updateOrderItemsOnly = (items: EditableOrderItem[]) => {
    setOrderForm((current) => {
      if (!current) return current;
      const ratio = current.total > 0 ? current.expenses / current.total : 0.65;
      const totals = computeOrderTotals(items, ratio);
      return {
        ...current,
        items,
        total: totals.total,
        expenses: totals.expenses,
        profit: totals.profit,
      };
    });
  };

  const updateOrderItems = (items: EditableOrderItem[]) => {
    setOrderForm((current) => {
      if (!current) return current;
      const ratio = current.total > 0 ? current.expenses / current.total : 0.65;
      const totals = computeOrderTotals(items, ratio);
      return {
        ...current,
        items,
        total: totals.total,
        expenses: totals.expenses,
        profit: totals.profit,
      };
    });
  };

  const updateOrderItemProduct = (index: number, name: string) => {
    if (!orderForm) return;
    const product = allProducts.find(
      (candidate) => candidate.name.toLowerCase() === name.trim().toLowerCase(),
    );
    const nextItems = [...orderForm.items];
    const currentItem = nextItems[index];
    if (!currentItem) return;
    const supplier = getSupplierForItem(
      name,
      product?.parentId ?? product?.id,
      product?.variantId,
    )?.supplier;
    nextItems[index] = {
      ...currentItem,
      productId: product?.parentId ?? product?.id,
      variantId: product?.variantId,
      variantName: product?.variantName,
      name,
      brand: product?.brand ?? selectedOrderStore,
      price: product?.price ?? 0,
      priceCurrency: product?.priceCurrency,
      gastos: product?.gastos ?? 0,
      gastosCurrency: product?.gastosCurrency ?? product?.priceCurrency ?? "ARS",
      supplier: supplier
        ? {
            name: supplier.name,
            phone: supplier.phone,
            social: supplier.social,
          }
        : undefined,
      stock: product?.stockUnlimited ? undefined : product?.stock,
      quantity: product
        ? Math.max(
            1,
            Math.min(
              currentItem.quantity || 1,
              product.stockUnlimited
                ? Number.MAX_SAFE_INTEGER
                : Math.max(product.stock, currentItem.originalQuantity ?? 0),
            ),
          )
        : currentItem.quantity,
    };
    updateOrderItemsOnly(nextItems);
  };

  const handleAddShippingNumber = (orderId: string) => {
    const current = editableOrders.find((order) => order.id === orderId)?.shippingNumber ?? "";
    const shippingNumber = window.prompt("Ingrese número de envío", current) ?? "";

    setEditableOrders((currentOrders) => {
      const nextOrders = currentOrders.map((order) =>
        order.id === orderId
          ? ({
              ...order,
              shippingNumber: shippingNumber.trim() || undefined,
            } as Order)
          : order,
      );
      saveOrders(nextOrders);
      return nextOrders;
    });
  };

  const addOrderItem = () => {
    if (!orderForm) return;
    setOrderForm({
      ...orderForm,
      items: [
        ...orderForm.items,
        {
          name: "",
          quantity: 0,
          price: 0,
          stock: undefined,
          confirmed: false,
          originalName: "",
          originalQuantity: 0,
          brand: selectedOrderStore,
        },
      ],
    });
  };

  const removeOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    nextItems.splice(index, 1);
    updateOrderItems(nextItems);
  };

  const startEditOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    if (index < 0 || index >= nextItems.length) return;
    const item = nextItems[index];
    if (!item) return;
    nextItems[index] = {
      ...item,
      confirmed: false,
      originalName: item.originalName ?? item.name,
      originalQuantity: item.originalQuantity ?? item.quantity,
    };
    updateOrderItems(nextItems);
  };

  const cancelEditOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    if (index < 0 || index >= nextItems.length) return;
    const item = nextItems[index];
    if (!item) return;

    if (item.originalName !== undefined) {
      nextItems[index] = {
        ...item,
        name: item.originalName,
        quantity: item.originalQuantity ?? item.quantity,
        confirmed: true,
      };
    } else {
      nextItems.splice(index, 1);
    }

    updateOrderItems(nextItems);
  };

  const confirmOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    if (index < 0 || index >= nextItems.length) return;
    const item = nextItems[index];
    if (
      !item ||
      !item.name ||
      item.quantity < 1 ||
      (item.stock !== undefined && item.quantity > item.stock)
    )
      return;
    nextItems[index] = {
      ...item,
      confirmed: true,
      originalName: item.name,
      originalQuantity: item.quantity,
    };
    updateOrderItems(nextItems);
  };

  const unconfirmOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    if (index < 0 || index >= nextItems.length) return;
    const item = nextItems[index];
    if (!item) return;
    nextItems[index] = {
      ...item,
      confirmed: false,
      originalName: item.originalName ?? "",
      originalQuantity: item.originalQuantity ?? 0,
    };
    updateOrderItems(nextItems);
  };

  const isOrderFormValid = orderForm
    ? orderForm.items.every(
        (item) =>
          item.name &&
          item.confirmed &&
          item.quantity >= 1 &&
          (item.originalName !== undefined ||
            item.stock === undefined ||
            item.quantity <= item.stock),
      )
    : true;
  const hasOrderChanges = orderForm
    ? JSON.stringify(orderForm) !== initialOrderFormSnapshot.current
    : false;

  const closeOrderEditor = () => {
    setDialogOpen(false);
    setOrderForm(null);
    setIsCreatingOrder(false);
    setBulkOrderEditQueue([]);
    setBulkOrderEditPosition(0);
    setSelectedOrderIds([]);
    setSelectionMode(false);
  };

  const handleSaveOrder = () => {
    if (!orderForm) return;
    if (isCreatingOrder && !orderForm.date.trim()) {
      toast.error("La fecha de compra es obligatoria.");
      return;
    }
    if (!isOrderFormValid) return;
    const selectedStoreForm = saveSelectedStoreValues(orderForm, selectedOrderStore);
    const originalForm = JSON.parse(initialOrderFormSnapshot.current ?? "null") as EditableOrder | null;
    if (!originalForm) return;
    const selectedStoreItems = selectedStoreForm.items.filter(
      (item) => item.brand === selectedOrderStore,
    );
    const preservedItems = originalForm.items.filter(
      (item) => item.brand !== selectedOrderStore,
    );
    const mergedItems = [...preservedItems, ...selectedStoreItems];
    const totals = computeOrderTotals(mergedItems, orderForm.total ? orderForm.expenses / orderForm.total : 0.65);
    const orderToSave: EditableOrder = {
      ...selectedStoreForm,
      items: mergedItems,
      total: totals.total,
      expenses: totals.expenses,
      profit: totals.profit,
    };
    setEditableOrders((current) => {
      const nextOrders = isCreatingOrder
        ? [orderToSave, ...current]
        : current.map((order) => (order.id === orderToSave.id ? orderToSave : order));
      saveOrders(nextOrders);
      return nextOrders;
    });
    setOrderForm(orderToSave);
    setIsCreatingOrder(false);
    initialOrderFormSnapshot.current = JSON.stringify(orderToSave);
    toast.success("Cambios guardados");
  };

  const changeSelectedOrderStore = (store: BrandSlug) => {
    if (!orderForm || store === selectedOrderStore) return;
    const nextForm = saveSelectedStoreValues(orderForm, selectedOrderStore);
    const storeValues = applySelectedStoreValues(nextForm, store);
    setSelectedOrderStore(store);
    setOrderForm({
      ...nextForm,
      ...storeValues,
    });
  };

  const clearOrderSelection = useCallback(() => {
    setSelectedOrderIds([]);
    setSelectionMode(false);
  }, []);

  const toggleOrderSelection = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((current) => {
      const next = checked
        ? current.includes(orderId)
          ? current
          : [...current, orderId]
        : current.filter((id) => id !== orderId);
      setSelectionMode(next.length > 0);
      return next;
    });
  };

  const handleBulkQuickEditOrders = () => {
    const queue = [...selectedOrderIds];
    if (!queue.length) return;

    const firstOrder = editableOrders.find((order) => order.id === queue[0]);
    if (!firstOrder) return;

    const isBulk = queue.length > 1;
    setIsBulkQuickEditing(isBulk);
    setExpandedOrderId(null);
    setBulkQuickEditOrderQueue(queue.slice(1));
    startQuickEditOrder(firstOrder, isBulk);
  };

  const handleBulkDeleteOrders = () => {
    const ids = new Set(selectedOrderIds);
    editableOrders
      .filter((order) => ids.has(order.id))
      .forEach((order) => {
        moveToTrash({ type: "pedido", id: order.id, item: order });
      });
    setEditableOrders((current) => {
      const next = current.filter((order) => !ids.has(order.id));
      saveOrders(next);
      return next;
    });
    clearOrderSelection();
  };

  const handleDeleteOrder = (order: Order) => {
    moveToTrash({ type: "pedido", id: order.id, item: order });
    setEditableOrders((currentOrders) => {
      const nextOrders = currentOrders.filter((currentOrder) => currentOrder.id !== order.id);
      saveOrders(nextOrders);
      return nextOrders;
    });
    if (selectedOrderIds.includes(order.id)) {
      clearOrderSelection();
    }
  };

  const handleBulkDuplicateOrders = () => {
    setEditableOrders((current) => {
      const selected = current.filter((order) => selectedOrderIds.includes(order.id));
      const duplicates = selected.map((order) => ({
        ...order,
        id: `LRG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: "",
      }));
      const next = [...duplicates, ...current];
      saveOrders(next);
      return next;
    });
    clearOrderSelection();
  };

  const handleBulkEditOrders = () => {
    const order = editableOrders.find((item) => item.id === selectedOrderIds[0]);
    if (order) {
      clearOrderSelection();
      setBulkOrderEditQueue(selectedOrderIds);
      setBulkOrderEditPosition(0);
      openEditOrderDialog(order);
    }
  };

  const navigateBulkEditOrder = (direction: -1 | 1) => {
    const nextPosition = bulkOrderEditPosition + direction;
    const nextOrderId = bulkOrderEditQueue[nextPosition];
    const nextOrder = editableOrders.find((order) => order.id === nextOrderId);
    if (!nextOrder) return;
    setBulkOrderEditPosition(nextPosition);
    openEditOrderDialog(nextOrder);
  };

  const getSupplierForItem = (itemName: string, productId?: string, variantId?: string) => {
    const normalizedName = itemName.trim().toLowerCase();
    const product = allProducts.find(
      (candidate) =>
        candidate.id === productId ||
        candidate.name.toLowerCase() === normalizedName ||
        candidate.variants?.some((variant) => variant.name.toLowerCase() === normalizedName),
    );
    const variant = product?.variants?.find(
      (candidate) => candidate.id === variantId || candidate.name.toLowerCase() === normalizedName,
    );
    return product
      ? { productName: product.name, supplier: variant?.supplier ?? product.supplier }
      : undefined;
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="order-1 basis-full shrink-0">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Ventas</p>
          <h1 className="mt-2 text-3xl font-semibold">Pedidos</h1>
        </div>

        <div className="order-2 relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar pedido"
            className="h-9 pl-9"
          />
        </div>

        <div className="order-3 flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-start sm:gap-2">
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:contents">
            <Button
              variant="default"
              size="sm"
              onClick={openNewOrderDialog}
              className="h-9 w-full shrink-0 gap-2 px-4 py-2 text-sm sm:w-auto"
            >
              <Plus className="size-4" />
              Nuevo pedido
            </Button>
          </div>

          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:contents">
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
                      ["customer_asc", "Cliente: A-Z"],
                      ["customer_desc", "Cliente: Z-A"],
                      ["date_desc", "Fecha de venta: más recientes"],
                      ["date_asc", "Fecha de venta: más antiguas"],
                      ["total_asc", "Precio total: menor a mayor"],
                      ["total_desc", "Precio total: mayor a menor"],
                      ["profit_asc", "Ganancias: menor a mayor"],
                      ["profit_desc", "Ganancias: mayor a menor"],
                    ] as [OrderSort, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSortOrder(value);
                        setSortMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2 ${
                        sortOrder !== null && sortOrder === value
                          ? "bg-surface-2 text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span>{label}</span>
                      {sortOrder !== null && sortOrder === value && (
                        <span aria-hidden="true">✓</span>
                      )}
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
                  className="h-9 shrink-0 gap-1.5 px-2.5"
                  aria-expanded={filtersOpen}
                >
                  <Filter className="size-4 text-white" />
                  Filtros
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                <DialogHeader className="space-y-2">
                  <DialogTitle>Filtros</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  {filterSections.map(
                    ({ label, open, setOpen, selected, setSelected, options }) => (
                      <div key={label} className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setOpen((current) => !current)}
                          className="flex items-center gap-2 text-sm font-medium"
                          aria-expanded={open}
                        >
                          <span>{label}</span>
                          {selected.length > 0 && (
                            <Badge variant="secondary">{selected.length}</Badge>
                          )}
                          {open ? (
                            <ChevronUp className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          )}
                        </button>
                        {open && (
                          <div className="space-y-2.5">
                            {[{ value: "todos", label: "Todos" }, ...options].map((option) => (
                              <label
                                key={option.value}
                                className="flex cursor-pointer items-start gap-3 text-sm"
                              >
                                <Checkbox
                                  checked={
                                    option.value === "todos"
                                      ? selected.length === 0
                                      : selected.includes(option.value)
                                  }
                                  onCheckedChange={(checked) =>
                                    setSelected(option.value, checked === true)
                                  }
                                />
                                <span className="font-medium">{option.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ),
                  )}

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setPriceFilterOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={priceFilterOpen}
                    >
                      <span>Precio total</span>
                      {currencyFilter.length === 1 && (
                        <Badge variant="secondary">{currencyFilter.length}</Badge>
                      )}
                      {priceFilterOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {priceFilterOpen && (
                      <div className="space-y-2.5">
                        {(["ARS", "USD"] as const).map((currency) => (
                          <label
                            key={currency}
                            className="flex cursor-pointer items-start gap-3 text-sm"
                          >
                            <Checkbox
                              checked={currencyFilter.includes(currency)}
                              onCheckedChange={(checked) =>
                                setCurrencyFilter((current) =>
                                  checked
                                    ? Array.from(new Set([...current, currency]))
                                    : current.length === 1
                                      ? current
                                      : current.filter((value) => value !== currency),
                                )
                              }
                            />
                            <span className="font-medium">
                              {currency === "ARS" ? "$ (ARS)" : "USD (Dólar)"}
                            </span>
                          </label>
                        ))}
                        <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
                          <label className="flex shrink-0 items-center gap-2">
                            <span>Desde {priceCurrencyLabel}</span>
                            <Input
                              type="number"
                              min={0}
                              max={priceLimit}
                              value={priceMin}
                              onChange={(event) =>
                                setPriceMin(
                                  Math.min(Math.max(0, Number(event.target.value) || 0), priceMax),
                                )
                              }
                              className="h-8 w-20 px-2 sm:w-24"
                            />
                          </label>
                          <label className="flex shrink-0 items-center justify-end gap-2">
                            <span>Hasta {priceCurrencyLabel}</span>
                            <Input
                              type="number"
                              min={0}
                              max={priceLimit}
                              value={priceMax}
                              onChange={(event) =>
                                setPriceMax(
                                  Math.max(
                                    Math.min(priceLimit, Number(event.target.value) || 0),
                                    priceMin,
                                  ),
                                )
                              }
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

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setQuantityFilterOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={quantityFilterOpen}
                    >
                      <span>Cantidad</span>
                      {(quantityMin > 0 || quantityMax < quantityLimit) && (
                        <Badge variant="secondary">1</Badge>
                      )}
                      {quantityFilterOpen ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                    </button>
                    {quantityFilterOpen && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
                          <label className="flex shrink-0 items-center gap-2">
                            <span>Desde</span>
                            <Input
                              type="number"
                              min={0}
                              max={quantityLimit}
                              value={quantityMin}
                              onChange={(event) =>
                                setQuantityMin(
                                  Math.min(
                                    Math.max(0, Number(event.target.value) || 0),
                                    quantityMax,
                                  ),
                                )
                              }
                              className="h-8 w-20 px-2 sm:w-24"
                            />
                          </label>
                          <label className="flex shrink-0 items-center justify-end gap-2">
                            <span>Hasta</span>
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
                              className="h-8 w-20 px-2 sm:w-24"
                            />
                          </label>
                        </div>
                        <Slider
                          min={0}
                          max={quantityLimit}
                          step={1}
                          value={[quantityMin, quantityMax]}
                          onValueChange={(value) => {
                            const nextMin = value[0] ?? 0;
                            const nextMax = value[1] ?? quantityLimit;
                            setQuantityMin(Math.min(nextMin, nextMax));
                            setQuantityMax(Math.max(nextMin, nextMax));
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-4">
                  <p className="text-xs text-muted-foreground">
                    {results.length} pedidos encontrados
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetFilters}
                    disabled={activeFilterCount === 0}
                    className="h-8 px-2 text-xs"
                  >
                    <X className="mr-1 size-3.5" /> Limpiar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div
            id="lrg-export-pedidos-buttons"
            className="flex w-full flex-wrap items-center justify-start gap-2 sm:contents"
          >
            <Button
              className="order-1 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700"
              onClick={() => {
                try {
                  exportOrdersExcel(results);
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              <Sheet className="size-4" />
              Exportar Excel
            </Button>

            <Button
              className="order-1 inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700"
              onClick={() => {
                try {
                  exportOrdersPdf(results);
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              <FileText className="size-4" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(v) => setConfirmState((s) => ({ ...s, open: v }))}
        title={confirmState.title}
        description={confirmState.description ?? ""}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={() => {
          try {
            confirmState.onConfirm();
          } finally {
            setConfirmState((s) => ({ ...s, open: false }));
          }
        }}
      />

      <div className="mt-2 flex min-h-9 basis-full flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 leading-none">
          <button
            type="button"
            className="text-sm font-medium leading-none text-foreground"
            onClick={() => {
              setSelectionMode((current) => {
                if (current) setSelectedOrderIds([]);
                return !current;
              });
            }}
          >
            Seleccionar
          </button>
          <Checkbox
            className="h-4 w-4 rounded-full border-2 border-primary bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            checked={
              allVisibleOrdersSelected ? true : someVisibleOrdersSelected ? "indeterminate" : false
            }
            onCheckedChange={(checked) => {
              if (checked === false) {
                setSelectionMode(false);
                setSelectedOrderIds([]);
                return;
              }
              setSelectionMode(true);
              const shouldSelect = checked === true || checked === "indeterminate";
              setSelectedOrderIds((current) =>
                shouldSelect
                  ? [...new Set([...current, ...visibleOrderIds])]
                  : current.filter((id) => !visibleOrderIds.includes(id)),
              );
            }}
            aria-label="Seleccionar pedidos visibles"
          />
          {selectedOrderIds.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {selectedOrderIds.length} seleccionados
            </span>
          ) : null}
        </div>
        {selectedOrderIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {quickEditOrderId !== null ? (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    const currentOrder = editableOrders.find((order) => order.id === quickEditOrderId);
                    if (currentOrder) saveQuickEditOrder(currentOrder);
                  }}
                >
                  <Check className="size-4" /> Guardar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={cancelQuickEditOrder}
                >
                  <X className="size-4" /> Saltar
                </Button>
                <Button size="sm" variant="outline" onClick={cancelQuickEditSession}>
                  <X className="size-4" /> Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={handleBulkQuickEditOrders}>
                  <Edit3 className="size-4" /> Editar rápido
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkEditOrders}>
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    setConfirmState({
                      open: true,
                      title: "Eliminar pedidos seleccionados?",
                      description: "Esta acción no se puede deshacer.",
                      onConfirm: handleBulkDeleteOrders,
                    })
                  }
                >
                  <Trash2 className="size-4" /> Eliminar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedOrderIds([]);
                  }}
                >
                  <X className="size-4" /> Cancelar
                </Button>
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl">
        <div className="glass-panel min-w-0 flex-1 overflow-visible rounded-2xl">
          <Table
            hideScrollbarOnMobile
            alwaysShowScrollbarOnDesktop
            stickyHeader
            stickyScrollbar
            containerClassName={cn(
              "touch-pan-x overscroll-x-contain overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]",
            )}
            className={cn(
              "w-full table-fixed border-collapse text-sm [&_td]:align-middle [&_th]:align-middle [&_td]:px-2 [&_th]:px-2 [&_td]:py-1.5 [&_th]:py-1.5 [&_td]:text-center [&_th]:text-center",
              selectionMode ? "min-w-200" : "min-w-0",
            )}
          >
            <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-center [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
              <TableRow>
                <TableHead className="w-10 px-1"> </TableHead>
                <TableHead className="w-24 min-w-24 max-w-24">Pedido</TableHead>
                <TableHead className="w-20">Fecha</TableHead>
                <TableHead className="w-24">Estado de pago</TableHead>
                <TableHead className="w-28">Núm. envío</TableHead>
                <TableHead className="w-24">Estado de envío</TableHead>
                <TableHead className="w-24">Fecha envío</TableHead>
                <TableHead className="w-18">Gastos</TableHead>
                <TableHead className="w-20">Total</TableHead>
                <TableHead className="w-18">Ganancias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleResults.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const nameParts = order.customer.split(" ");
                const displayCustomer =
                  nameParts.length > 1
                    ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
                    : order.customer;
                const displayDeliveryStatus =
                  (order as Order & { deliveryStatus?: DeliveryStatus }).deliveryStatus ??
                  getDeliveryStatus(order.status);
                const displayPaymentStatus =
                  (order as Order & { paymentStatus?: PaymentStatus }).paymentStatus ??
                  getPaymentStatus(order.status);

                const isQuickEditing = quickEditOrderId === order.id;
                const quickDraft = quickEditOrderForm[order.id] ?? {
                  deliveryStatus: displayDeliveryStatus,
                  paymentStatus: displayPaymentStatus,
                  shippingMethod: order.shippingMethod ?? "",
                  shippingNumber: order.shippingNumber ?? "",
                  paymentMethod: order.paymentMethod,
                  deliveryDate: order.deliveryDate ?? "",
                };
                const quickEditHasChanges =
                  JSON.stringify(quickDraft) !== quickEditOriginalSnapshots.current[order.id];

                return (
                  <Fragment key={order.id}>
                    <TableRow
                      id={`pedido-${order.id}`}
                      ref={isQuickEditing ? quickEditRowRef : undefined}
                      onClick={(event) => {
                        if (
                          selectionMode ||
                          isQuickEditing ||
                          (event.target as HTMLElement).closest(
                            "button, input, [role=checkbox], [role=combobox], a",
                          )
                        )
                          return;
                        setExpandedOrderId(isExpanded ? null : order.id);
                      }}
                      className={
                        highlightedOrderId === order.id
                          ? "animate-pulse border border-amber-400/80 bg-linear-to-r from-amber-500/25 via-yellow-300/25 to-amber-500/25 shadow-[0_0_0_1px_rgba(251,191,36,0.55),0_0_18px_rgba(251,191,36,0.28)]"
                          : !selectionMode && !isQuickEditing
                            ? "cursor-pointer hover:bg-transparent"
                            : undefined
                      }
                    >
                      <TableCell className="w-10 px-1">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            className="h-4 w-4 rounded-full border-2 border-primary bg-transparent data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                            checked={selectedOrderIds.includes(order.id)}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={(checked) => {
                              const isChecked = checked === true;
                              setSelectedOrderIds((current) => {
                                const next = isChecked
                                  ? current.includes(order.id)
                                    ? current
                                    : [...current, order.id]
                                  : current.filter((id) => id !== order.id);
                                setSelectionMode(next.length > 0);
                                return next;
                              });
                            }}
                            aria-label={`Seleccionar pedido ${order.id}`}
                          />
                        </div>
                      </TableCell>

                      <TableCell className="w-24 min-w-24 max-w-24 text-center text-sm font-medium">
                        <div className="flex min-w-0 items-center justify-center gap-1 text-center">
                          <div className="flex min-w-0 flex-col items-center gap-1">
                            <span className="min-w-0 break-all text-sm leading-tight">
                              {order.id}
                            </span>
                            {order.isGuest && (
                              <Badge
                                variant="warning"
                                className="shrink-0 px-1.5 py-0.5 text-[9px]"
                              >
                                Invitado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(order.date)}</TableCell>
                      <TableCell>
                        {isQuickEditing ? (
                          <Select
                            value={quickDraft.paymentStatus}
                            onValueChange={(value) =>
                              setQuickEditOrderForm((current) => ({
                                ...current,
                                [order.id]: {
                                  ...quickDraft,
                                  paymentStatus: value as PaymentStatus,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["Pendiente", "Pagado", "Cancelado"] as PaymentStatus[]).map(
                                (paymentOption) => (
                                  <SelectItem key={paymentOption} value={paymentOption}>
                                    {paymentOption}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            className="capitalize"
                            variant={paymentVariant[displayPaymentStatus]}
                          >
                            {displayPaymentStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isQuickEditing ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <Input
                            value={order.shippingNumber ?? ""}
                            placeholder="-"
                            disabled={!order.shippingNumber}
                            readOnly
                            className="w-full text-center"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {isQuickEditing ? (
                          <Select
                            value={quickDraft.deliveryStatus}
                            onValueChange={(value) =>
                              setQuickEditOrderForm((current) => ({
                                ...current,
                                [order.id]: {
                                  ...quickDraft,
                                  deliveryStatus: value as DeliveryStatus,
                                },
                              }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(["Pendiente", "Enviado"] as DeliveryStatus[]).map(
                                (statusOption) => (
                                  <SelectItem key={statusOption} value={statusOption}>
                                    {statusOption}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            className="capitalize"
                            variant={deliveryVariant[displayDeliveryStatus]}
                          >
                            {displayDeliveryStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isQuickEditing ? (
                          <Input
                            type="date"
                            value={quickDraft.deliveryDate}
                            onChange={(event) =>
                              setQuickEditOrderForm((current) => ({
                                ...current,
                                [order.id]: {
                                  ...quickDraft,
                                  deliveryDate: event.target.value,
                                },
                              }))
                            }
                            className="w-full"
                          />
                        ) : order.deliveryDate ? (
                          formatDate(order.deliveryDate)
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{formatPrice(order.expenses)}</TableCell>
                      <TableCell>{formatPrice(order.total)}</TableCell>
                      <TableCell>{formatPrice(order.profit)}</TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow
                        key={`${order.id}-details`}
                        ref={expandedOrderId === order.id ? quickEditDetailRef : undefined}
                      >
                        <TableCell colSpan={10} className="w-full bg-surface-2/90 p-0 sm:p-0">
                          <div className="w-full min-w-0 space-y-4 overflow-hidden rounded-2xl bg-surface-2/90 p-3 text-sm sm:p-5">
                            {isQuickEditing && !isBulkQuickEditing && (
                              <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border/50 pb-3">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => saveQuickEditOrder(order)}
                                  disabled={!quickEditHasChanges}
                                  className="h-7 gap-1 bg-transparent px-2 text-xs text-green-600 hover:bg-green-100/80 hover:text-green-700 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-green-700/40"
                                >
                                  <Check className="size-3.5" /> Guardar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelQuickEditOrder}
                                  className="h-7 gap-1 bg-transparent px-2 text-xs text-destructive hover:bg-destructive/10"
                                >
                                  <X className="size-3.5" /> Cancelar
                                </Button>
                              </div>
                            )}

                            <p className="font-medium">Detalle del pedido</p>

                            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
                              <div className="min-w-0 space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4">
                                <div>
                                  <span className="block text-xs text-muted-foreground">Cliente</span>
                                  <span className="block wrap-break-word text-base font-medium">
                                    {displayCustomer}
                                  </span>
                                  {order.isGuest && <Badge variant="warning">Invitado</Badge>}
                                </div>
                                <div>
                                  <span className="block text-xs text-muted-foreground">Correo</span>
                                  <span className="block break-all">{order.email || "—"}</span>
                                </div>
                                <div>
                                  <span className="block text-xs text-muted-foreground">Celular</span>
                                  <span className="block wrap-break-word">{order.phone || "—"}</span>
                                </div>
                              </div>

                              <div className="min-w-0 space-y-3">
                                <div className="space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    {order.items.length > 4 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => setProductListModalOrder(order)}
                                      >
                                        Ver más
                                      </Button>
                                    )}
                                  </div>

                                  <ul className="grid min-w-0 gap-2 text-sm">
                                    {order.items.slice(0, 4).map((item, itemIndex) => {
                                      const product = allProducts.find(
                                        (candidate) =>
                                          candidate.id === item.productId ||
                                          candidate.variantId === item.variantId ||
                                          candidate.name === item.name,
                                      );
                                      const supplier = getSupplierForItem(
                                        item.name,
                                        item.productId,
                                        item.variantId,
                                      )?.supplier;
                                      const itemBrand = item.brand ?? product?.brand ?? order.brand;
                                      const resolvedVariantName =
                                        item.variantName ??
                                        product?.variantName ??
                                        product?.variants?.find((variant) => variant.id === item.variantId)
                                          ?.name;

                                      return (
                                        <li
                                          key={`${item.name}-${item.variantId ?? itemIndex}`}
                                          className="rounded-xl bg-surface p-3"
                                        >
                                          <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0 text-left">
                                              <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                  {getBrandFullName(itemBrand)}
                                                </span>
                                                <span className="wrap-break-word font-medium">
                                                  {item.name}
                                                </span>
                                                {resolvedVariantName && (
                                                  <span className="text-muted-foreground">
                                                    ({resolvedVariantName})
                                                  </span>
                                                )}
                                              </div>
                                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                <span>Proveedor: {supplier?.name ?? "Sin proveedor asignado"}</span>
                                                <span>•</span>
                                                <span>{item.quantity} ud.</span>
                                                <span>•</span>
                                                <span>{formatPrice(item.price)}</span>
                                              </div>
                                            </div>
                                            <span className="shrink-0 text-right font-medium">
                                              {formatPrice(item.price * item.quantity)}
                                            </span>
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>

                              </div>
                            </div>

                            {(() => {
                              const storeSlugs = Array.from(
                                new Map(
                                  order.items.map((item) => {
                                    const product = allProducts.find(
                                      (candidate) =>
                                        candidate.id === item.productId || candidate.name === item.name,
                                    );
                                    const itemBrand = item.brand ?? product?.brand ?? order.brand;
                                    return [itemBrand, itemBrand] as const;
                                  }),
                                ).values(),
                              );

                              return (
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                  {storeSlugs.map((brandSlug) => {
                                    const itemsInBrand = order.items.filter((item) => {
                                      const product = allProducts.find(
                                        (candidate) =>
                                          candidate.id === item.productId || candidate.name === item.name,
                                      );
                                      return (item.brand ?? product?.brand ?? order.brand) === brandSlug;
                                    });
                                    const suppliers = Array.from(
                                      new Set(
                                        itemsInBrand
                                          .map((item) =>
                                            getSupplierForItem(
                                              item.name,
                                              item.productId,
                                              item.variantId,
                                            )?.supplier?.name,
                                          )
                                          .filter((name): name is string => Boolean(name)),
                                      ),
                                    );

                                    return (
                                      <div
                                        key={brandSlug}
                                        className="rounded-xl border border-border/60 bg-surface/40 p-4"
                                      >
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                          <span className="text-sm font-semibold">
                                            {getBrandFullName(brandSlug)}
                                          </span>
                                        </div>
                                        <div className="space-y-2.5 text-sm">
                                          {[
                                            ["Método de pago", order.paymentMethod || "—"],
                                            ["Método de envío", order.shippingMethod || "—"],
                                            [
                                              "Proveedor",
                                              suppliers.length
                                                ? suppliers.join(", ")
                                                : "Sin proveedor asignado",
                                            ],
                                            ["Observaciones", order.extraInfo || "—"],
                                          ].map(([label, value]) => (
                                            <div
                                              key={label}
                                              className="flex items-start justify-between gap-3"
                                            >
                                              <span className="min-w-0 text-muted-foreground">{label}</span>
                                              <span className="min-w-0 max-w-[60%] text-right wrap-break-word font-medium">
                                                {String(value)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            <div className="flex flex-wrap justify-center gap-2 border-t border-border/50 pt-3">
                              {!isQuickEditing ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReceiptsOrder(order)}
                                    className="h-8 gap-2 rounded-md px-3 text-xs"
                                  >
                                    <FileText className="size-4" /> Comprobantes de pago del cliente
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDocumentsOrder(order);
                                      setPendingAttachments([]);
                                    }}
                                    className="h-8 gap-2 rounded-md px-3 text-xs"
                                  >
                                    <Paperclip className="size-4" /> Subir archivos para el cliente
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => startQuickEditOrder(order)}
                                    className="h-8 gap-2 rounded-md border border-input bg-background px-3 text-xs shadow-none hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Edit3 className="size-4" /> Editar rápido
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditOrderDialog(order)}
                                    className="h-8 gap-2 rounded-md border border-input bg-background px-3 text-xs shadow-none hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Pencil className="size-4" /> Editar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setConfirmState({
                                        open: true,
                                        title: `Eliminar pedido ${order.id}?`,
                                        description: "Esta acción no se puede deshacer.",
                                        onConfirm: () => handleDeleteOrder(order),
                                      })
                                    }
                                    className="h-8 gap-2 rounded-md border border-input bg-background px-3 text-xs text-destructive shadow-none hover:bg-destructive/10"
                                  >
                                    <Trash2 className="size-4" /> Eliminar
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExpandedOrderId(null)}
                                    className="h-8 gap-2 rounded-md px-3 text-xs"
                                  >
                                    <EyeOff className="size-4" /> Ocultar
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
              {results.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    No se encontraron pedidos.
                  </TableCell>
                </TableRow>
              ) : null}
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
            className="h-9 rounded-full border-0 bg-[#111827] px-4 text-white shadow-none hover:bg-[#1f2937]"
          >
            Principio
          </Button>
          <div className="flex items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
            {Array.from({ length: Math.max(totalPages, 1) }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`rounded-full border-0 px-3 py-1 outline-none transition-colors focus-visible:outline-none ${index === page ? "bg-[#111827] text-white shadow-none" : "bg-transparent text-muted-foreground hover:bg-surface-2"}`}
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
            className="h-9 rounded-full border-0 bg-[#111827] px-4 text-white shadow-none hover:bg-[#1f2937]"
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
                  setPageSizeInput(String(final));
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
          {visibleResults.length} de {results.length} pedidos mostrados
        </p>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeOrderEditor()}>
        <DialogContent
          key={isCreatingOrder ? "new-order-dialog" : "edit-order-dialog"}
          className="w-[calc(100vw-1rem)] max-w-5xl max-h-[calc(100dvh-1rem)] overflow-x-hidden overflow-y-hidden p-4 shadow-none md:overflow-y-auto sm:w-[calc(100vw-2rem)] sm:p-6"
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>{isCreatingOrder ? "Nuevo pedido" : "Editar pedido"}</DialogTitle>
              {!isCreatingOrder && bulkOrderEditQueue.length > 1 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateBulkEditOrder(-1)}
                    disabled={bulkOrderEditPosition === 0}
                  >
                    <ArrowLeft className="size-4" /> Anterior
                  </Button>
                  <span>
                    {bulkOrderEditPosition + 1} / {bulkOrderEditQueue.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateBulkEditOrder(1)}
                    disabled={bulkOrderEditPosition >= bulkOrderEditQueue.length - 1}
                  >
                    Siguiente <ArrowRight className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </DialogHeader>
          {orderForm ? (
            <div className="min-w-0 space-y-4">
              <div className="space-y-4 rounded-xl border border-border/60 bg-surface/40 p-4">
                <p className="text-lg font-semibold tracking-tight text-foreground">Datos cliente</p>
                <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Número de pedido</Label>
                    <Input value={orderForm.id} disabled />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Cliente</Label>
                    <Input value={orderForm.customer} disabled />
                  </div>
                </div>

                <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Correo</Label>
                    <Input value={orderForm.email} disabled />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Celular</Label>
                    <Input value={orderForm.phone} disabled />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border/60 bg-surface/40 p-4">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-lg font-semibold tracking-tight text-foreground">
                    Datos del pedido
                  </p>
                  <div className="w-full max-w-xs">
                    <Select
                      value={selectedOrderStore}
                      onValueChange={(value) => changeSelectedOrderStore(value as BrandSlug)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar tienda" />
                      </SelectTrigger>
                      <SelectContent>
                        {orderStoreSlugs.map((store) => (
                          <SelectItem key={store} value={store}>
                            {getBrandDisplayName(store)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid min-w-0 items-start gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Método de pago</Label>
                    <Select
                      value={orderForm.paymentMethod}
                      onValueChange={(value) => {
                        const nextInstruction = getPaymentInstruction(
                          orderForm.paymentMethod,
                          value,
                        );
                        setOrderForm({ ...orderForm, paymentMethod: value });
                        setPaymentInstruction(nextInstruction);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethodOptions.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Estado de pago</Label>
                    <Select
                      value={orderForm.paymentStatus}
                      onValueChange={(value) => {
                        const nextPaymentStatus = value as PaymentStatus;
                        setOrderForm({
                          ...orderForm,
                          paymentStatus: nextPaymentStatus,
                          status: mergeOrderStatus(orderForm.deliveryStatus, nextPaymentStatus),
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {(["Pendiente", "Pagado", "Cancelado"] as PaymentStatus[]).map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Método de envío</Label>
                    <Select
                      value={orderForm.shippingMethod ?? ""}
                      onValueChange={(value) =>
                        setOrderForm({ ...orderForm, shippingMethod: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                      <SelectContent>
                        {shippingMethodOptions.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex min-w-0 flex-col gap-0">
                    <Label className="min-h-5">Estado de envío</Label>
                    <Select
                      value={orderForm.deliveryStatus}
                      onValueChange={(value) => {
                        const nextDeliveryStatus = value as DeliveryStatus;
                        setOrderForm({
                          ...orderForm,
                          deliveryStatus: nextDeliveryStatus,
                          status: mergeOrderStatus(nextDeliveryStatus, orderForm.paymentStatus),
                        });
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Pendiente", "Enviado"].map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Observaciones</Label>
                  <Textarea
                    value={orderForm.extraInfo}
                    onChange={(event) =>
                      setOrderForm({ ...orderForm, extraInfo: event.target.value })
                    }
                  />
                </div>

                {paymentInstruction ? (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
                    <p className="font-semibold">Instrucción de pago</p>
                    <p>{paymentInstruction}</p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-xl border border-border/60 bg-surface/40 p-4">
                <p className="text-lg font-semibold tracking-tight text-foreground">Productos</p>
                <div className="space-y-3">
                  {orderForm.items.map((item, itemIndex) => {
                    const productSuggestions = allProducts
                      .filter((product) =>
                        product.name.toLowerCase().includes(item.name.trim().toLowerCase()),
                      )
                      .slice(0, 6);
                    const selectedProduct = allProducts.find(
                      (product) => product.name.toLowerCase() === item.name.trim().toLowerCase(),
                    );
                    const selectedSupplier = getSupplierForItem(
                      item.name,
                      item.productId,
                      item.variantId,
                    )?.supplier;
                    const canEditProductName = !item.confirmed;
                    const hasUnlimitedStock = Boolean(selectedProduct?.stockUnlimited);
                    const exceedsStock = Boolean(
                      selectedProduct &&
                      !hasUnlimitedStock &&
                      item.quantity > selectedProduct.stock,
                    );
                    const itemHasChanges =
                      item.originalName === undefined ||
                      item.originalQuantity === undefined ||
                      item.name !== item.originalName ||
                      item.quantity !== item.originalQuantity;
                    const itemCanBeSaved =
                      itemHasChanges &&
                      Boolean(selectedProduct) &&
                      item.quantity >= 1 &&
                      (hasUnlimitedStock ||
                        item.quantity <=
                          Math.max(selectedProduct?.stock ?? 0, item.originalQuantity ?? 0));

                    return (
                      <div
                        key={`item-${itemIndex}`}
                        className="relative grid gap-2 rounded-xl border border-border/60 bg-surface/40 p-3 sm:grid-cols-[1.7fr_0.5fr_0.65fr_1.2fr_1.2fr_auto]"
                      >
                        <div className="relative">
                          <Label>Nombre</Label>
                          <Input
                            value={item.name}
                            placeholder="Escriba un producto"
                            disabled={!canEditProductName}
                            onChange={(event) =>
                              updateOrderItemProduct(itemIndex, event.target.value)
                            }
                          />
                          {canEditProductName &&
                            item.name.trim() &&
                            !selectedProduct &&
                            productSuggestions.length > 0 && (
                              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-lg">
                                {productSuggestions.map((product) => (
                                  <button
                                    key={product.id}
                                    type="button"
                                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                                    onClick={() => updateOrderItemProduct(itemIndex, product.name)}
                                  >
                                    <span className="min-w-0 truncate">{product.name}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      Stock: {product.stockUnlimited ? "Ilimitado" : product.stock}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>
                        <div>
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            disabled={item.confirmed || !selectedProduct}
                            onChange={(event) => {
                              const nextItems = [...orderForm.items];
                              nextItems[itemIndex] = {
                                ...item,
                                quantity: Math.max(1, Number(event.target.value) || 1),
                              };
                              updateOrderItemsOnly(nextItems);
                            }}
                          />
                          {exceedsStock && (
                            <p className="mt-1 text-xs text-destructive">
                              No hay stock suficiente. Disponible: {selectedProduct?.stock}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Precio</Label>
                          <Input type="number" min={0} step={0.01} value={item.price * item.quantity} disabled />
                        </div>
                        <div>
                          <Label>Número de envío</Label>
                          <Input
                            value={item.shippingNumber ?? ""}
                            onChange={(event) => {
                              const nextItems = [...orderForm.items];
                              nextItems[itemIndex] = {
                                ...item,
                                shippingNumber: event.target.value,
                              };
                              updateOrderItemsOnly(nextItems);
                            }}
                            placeholder="-"
                          />
                        </div>
                        <div>
                          <Label>Proveedor</Label>
                          <Input
                            value={
                              item.supplier?.name ?? selectedSupplier?.name ?? ""
                            }
                            placeholder="-"
                            disabled
                          />
                        </div>
                        <div className="flex flex-col items-stretch justify-end gap-1">
                          {item.confirmed ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => unconfirmOrderItem(itemIndex)}
                                className="h-8 justify-start px-2"
                              >
                                <Pencil className="size-4" /> Editar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setPendingOrderItemDeleteIndex(itemIndex)}
                                className="h-8 justify-start px-2 text-destructive hover:bg-destructive/20"
                              >
                                <Trash2 className="size-4" /> Eliminar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => confirmOrderItem(itemIndex)}
                                disabled={!itemCanBeSaved}
                                className="h-8 gap-2 rounded-md border border-transparent bg-transparent px-3 text-sm text-green-600 shadow-none hover:bg-green-100/80 hover:text-green-700 hover:shadow-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-green-700/40 disabled:opacity-100"
                              >
                                <Check className="size-4" /> Guardar
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => cancelEditOrderItem(itemIndex)}
                                className="h-8 gap-2 px-3 text-sm text-destructive hover:bg-destructive/10"
                              >
                                <X className="size-4" /> Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={addOrderItem}
                  className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground shadow-none hover:bg-primary/90 hover:text-primary-foreground hover:shadow-none"
                >
                  <Plus className="size-4" />
                  Agregar producto
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Gastos</Label>
                  <Input value={formatPrice(orderForm.expenses)} disabled />
                </div>
                <div>
                  <Label>Ganancias</Label>
                  <Input value={formatPrice(orderForm.profit)} disabled />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input value={formatPrice(orderForm.total)} disabled />
                </div>
              </div>

            </div>
          ) : null}

          <ConfirmDialog
            open={pendingOrderItemDeleteIndex !== null}
            onOpenChange={(open) => {
              if (!open) setPendingOrderItemDeleteIndex(null);
            }}
            title="Eliminar producto del pedido?"
            description="Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            cancelLabel="Cancelar"
            onConfirm={() => {
              if (pendingOrderItemDeleteIndex !== null) {
                removeOrderItem(pendingOrderItemDeleteIndex);
              }
              setPendingOrderItemDeleteIndex(null);
            }}
          />

          <DialogFooter>
            <div className="flex w-full items-center justify-between gap-2">
              {!isCreatingOrder && bulkOrderEditQueue.length > 1 ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateBulkEditOrder(-1)}
                    disabled={bulkOrderEditPosition === 0}
                  >
                    <ArrowLeft className="size-4" /> Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigateBulkEditOrder(1)}
                    disabled={bulkOrderEditPosition >= bulkOrderEditQueue.length - 1}
                  >
                    Siguiente <ArrowRight className="size-4" />
                  </Button>
                </div>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={closeOrderEditor}
                  className="rounded-md border border-transparent bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80 hover:text-secondary-foreground hover:shadow-none"
                  style={{ boxShadow: "none" }}
                >
                  <X className="h-4 w-4 mr-2" /> Cancelar
                </Button>
                <Button
                  variant="default"
                  onClick={handleSaveOrder}
                  disabled={!hasOrderChanges || !isOrderFormValid}
                  className="rounded-md border border-transparent bg-primary text-primary-foreground shadow-none hover:bg-primary/90 hover:text-primary-foreground hover:shadow-none disabled:opacity-50"
                  style={{ boxShadow: "none" }}
                >
                  <Save className="h-4 w-4 mr-2" /> Guardar pedido
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={productListModalOrder !== null}
        onOpenChange={(open) => !open && setProductListModalOrder(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Productos del pedido</DialogTitle>
            <DialogDescription>{productListModalOrder?.id}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {productListModalOrder?.items.map((item, itemIndex) => {
              const product = allProducts.find(
                (candidate) => candidate.id === item.productId || candidate.name === item.name,
              );
              const supplier = getSupplierForItem(item.name, item.productId, item.variantId)?.supplier;
              const itemBrand = item.brand ?? product?.brand ?? productListModalOrder.brand;
              const variantText =
                item.variantName && item.variantName !== item.name ? ` · ${item.variantName}` : "";

              return (
                <div
                  key={`${productListModalOrder.id}-${item.name}-${item.variantId ?? itemIndex}`}
                  className="rounded-xl border border-border/60 bg-surface/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {item.name}
                        {variantText && <span className="text-muted-foreground">{variantText}</span>}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{getBrandDisplayName(itemBrand)}</span>
                    <span>
                      {item.quantity} × {formatPrice(item.price)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Proveedor: {supplier?.name ?? "Sin proveedor asignado"}
                  </p>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setProductListModalOrder(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentsOrder !== null} onOpenChange={(open) => !open && cancelDocuments()}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg min-w-0 rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Documentos del pedido</DialogTitle>
            <DialogDescription>{documentsOrder?.id}</DialogDescription>
          </DialogHeader>
          <input
            ref={documentsInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={async (event) => {
              await addDocuments(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="space-y-2">
            {[...(documentsOrder?.attachments ?? []), ...pendingAttachments].length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay documentos adjuntos.</p>
            ) : (
              [...(documentsOrder?.attachments ?? []), ...pendingAttachments].map((attachment) => (
                <div
                  key={`${attachment.name}-${attachment.size}`}
                  className="flex min-w-0 items-start justify-between gap-3 rounded-lg border p-2 text-sm"
                >
                  <span className="min-w-0 flex-1 wrap-break-word">{attachment.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <a
                      href={attachment.dataUrl}
                      download={attachment.name}
                      className="rounded p-1 hover:bg-accent"
                      title="Descargar"
                    >
                      <Download className="size-4" />
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(attachment.name)}
                      disabled={isSavingDocuments}
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => documentsInputRef.current?.click()}
              disabled={isSavingDocuments}
            >
              <Paperclip className="size-4" /> Adjuntar archivos
            </Button>
            <Button
              type="button"
              onClick={saveDocuments}
              disabled={pendingAttachments.length === 0 || isSavingDocuments}
            >
              {isSavingDocuments ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="size-4" /> Guardar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiptsOrder !== null}
        onOpenChange={(open) => !open && setReceiptsOrder(null)}
      >
        <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle>🧾 Comprobantes de pago</DialogTitle>
            <DialogDescription>{receiptsOrder?.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(receiptsOrder?.paymentReceipts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay comprobantes adjuntos.</p>
            ) : (
              receiptsOrder?.paymentReceipts?.map((receipt) => (
                <div
                  key={`${receipt.name}-${receipt.size}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm"
                >
                  <span className="min-w-0 truncate">{receipt.name}</span>
                  <a
                    href={receipt.dataUrl}
                    download={receipt.name}
                    className="rounded p-1 hover:bg-accent"
                    title="Descargar comprobante"
                  >
                    <Download className="size-4" />
                  </a>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
