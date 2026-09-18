import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { orderQueries, type Order } from "@/services/catalog.service";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileText,
  Paperclip,
  Search,
  Sheet,
  Save,
  X,
  Filter,
} from "lucide-react";
import * as XLSX from "xlsx";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { saveOrders, orders as ordersData, type OrderAttachment } from "@/data/orders";
import { FilterChipList, type FilterChipItem } from "@/components/product/product-filters";

export const Route = createFileRoute("/admin/clientes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  head: () => ({ meta: [{ title: "Administrador" }] }),
  component: AdminClients,
});

function AdminClients() {
  const { data: orders = [] } = useSuspenseQuery(orderQueries.list());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageSizeInput, setPageSizeInput] = useState<string>("10");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<
    "name_asc" | "name_desc" | "orders_asc" | "orders_desc" | "spent_asc" | "spent_desc"
  >("name_asc");
  const [storeFilter, setStoreFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<Array<"ARS" | "USD">>(["ARS", "USD"]);
  const [ordersMin, setOrdersMin] = useState(0);
  const [ordersMax, setOrdersMax] = useState(0);
  const [spentMin, setSpentMin] = useState(0);
  const [spentMax, setSpentMax] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [spentOpen, setSpentOpen] = useState(false);
  type Customer = {
    key: string;
    name: string;
    email: string;
    isGuest: boolean;
    orders: Order[];
  };

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const o of orders) {
      const key = o.isGuest
        ? `guest:${o.guestCustomerId ?? o.id}`
        : o.email || o.customer || o.phone || o.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: o.customer,
          email: o.email,
          isGuest: Boolean(o.isGuest),
          orders: [],
        });
      }
      map.get(key)!.orders.push(o);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  const ordersLimit = Math.max(1, ...customers.map((customer) => customer.orders.length));
  const spentLimit = Math.max(
    1,
    ...customers.map((customer) =>
      customer.orders.reduce((sum, order) => sum + (order.total || 0), 0),
    ),
  );

  useEffect(() => {
    setOrdersMax(ordersLimit);
    setSpentMax(spentLimit);
  }, [ordersLimit, spentLimit]);

  const filteredCustomers = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = customers.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      const key = (c.key ?? "").toLowerCase();
      const totalSpent = c.orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const hasStore =
        !storeFilter.length || c.orders.some((order) => storeFilter.includes(order.brand));
      const typeMatches =
        !typeFilter.length || typeFilter.includes(c.isGuest ? "guest" : "customer");
      return (
        (!q || name.includes(q) || email.includes(q) || key.includes(q)) &&
        hasStore &&
        typeMatches &&
        c.orders.length >= ordersMin &&
        c.orders.length <= ordersMax &&
        totalSpent >= spentMin &&
        totalSpent <= spentMax
      );
    });
    return [...filtered].sort((a, b) => {
      const aSpent = a.orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const bSpent = b.orders.reduce((sum, order) => sum + (order.total || 0), 0);
      switch (sortOrder) {
        case "name_desc":
          return b.name.localeCompare(a.name);
        case "orders_asc":
          return a.orders.length - b.orders.length;
        case "orders_desc":
          return b.orders.length - a.orders.length;
        case "spent_asc":
          return aSpent - bSpent;
        case "spent_desc":
          return bSpent - aSpent;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [
    customers,
    query,
    sortOrder,
    storeFilter,
    typeFilter,
    ordersMin,
    ordersMax,
    spentMin,
    spentMax,
  ]);

  const visibleCustomers = useMemo(() => {
    if (!pageSize || pageSize <= 0) return [] as typeof customers;
    return filteredCustomers.slice(page * pageSize, page * pageSize + pageSize);
  }, [filteredCustomers, page, pageSize]);
  const totalPages =
    pageSize && pageSize > 0 ? Math.max(1, Math.ceil(filteredCustomers.length / pageSize)) : 1;
  const hasNextPage = page + 1 < totalPages;
  const hasPreviousPage = page > 0;
  const activeFilterCount =
    storeFilter.length +
    typeFilter.length +
    (currencyFilter.length === 1 ? 1 : 0) +
    (ordersMin > 0 ? 1 : 0) +
    (ordersMax < ordersLimit ? 1 : 0) +
    (spentMin > 0 ? 1 : 0) +
    (spentMax < spentLimit ? 1 : 0);
  const resetFilters = () => {
    setStoreFilter([]);
    setTypeFilter([]);
    setCurrencyFilter(["ARS", "USD"]);
    setOrdersMin(0);
    setOrdersMax(ordersLimit);
    setSpentMin(0);
    setSpentMax(spentLimit);
  };
  const toggleSelection = (
    selected: string[],
    value: string,
    checked: boolean,
    allValues: string[],
  ) => {
    if (value === "all") return [];
    const next = checked
      ? Array.from(new Set([...selected, value]))
      : selected.filter((item) => item !== value);
    return allValues.length > 0 && allValues.every((item) => next.includes(item)) ? [] : next;
  };
  const storeOptions = [
    ["arcade", "LRG Arcade"],
    ["scents", "LRG Scents"],
    ["web-design", "LRG Web Design"],
  ] as const;
  const sortOptions = [
    ["name_asc", "Cliente: A-Z"],
    ["name_desc", "Cliente: Z-A"],
    ["orders_asc", "Pedidos: menor a mayor"],
    ["orders_desc", "Pedidos: mayor a menor"],
    ["spent_asc", "Gastado: menor a mayor"],
    ["spent_desc", "Gastado: mayor a menor"],
  ] as const;
  const filterChips: FilterChipItem[] = [
    ...(query ? [{ key: "search", label: `Buscar: ${query}`, onRemove: () => setQuery("") }] : []),
    ...storeFilter.map((store) => ({
      key: `store-${store}`,
      label: storeOptions.find(([value]) => value === store)?.[1] ?? store,
      onRemove: () => setStoreFilter((current) => current.filter((item) => item !== store)),
    })),
    ...typeFilter.map((type) => ({
      key: `type-${type}`,
      label: type === "guest" ? "Invitados" : "Clientes",
      onRemove: () => setTypeFilter((current) => current.filter((item) => item !== type)),
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
    ...(ordersMin > 0
      ? [
          {
            key: "orders-min",
            label: `Pedidos desde ${ordersMin}`,
            onRemove: () => setOrdersMin(0),
          },
        ]
      : []),
    ...(ordersMax < ordersLimit
      ? [
          {
            key: "orders-max",
            label: `Pedidos hasta ${ordersMax}`,
            onRemove: () => setOrdersMax(ordersLimit),
          },
        ]
      : []),
    ...(spentMin > 0
      ? [{ key: "spent-min", label: `Gastado desde ${spentMin}`, onRemove: () => setSpentMin(0) }]
      : []),
    ...(spentMax < spentLimit
      ? [
          {
            key: "spent-max",
            label: `Gastado hasta ${spentMax}`,
            onRemove: () => setSpentMax(spentLimit),
          },
        ]
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="order-1 basis-full shrink-0">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Listado</p>
          <h1 className="mt-2 text-3xl font-semibold">Clientes</h1>
        </div>

        <div className="order-2 relative min-w-0 basis-full flex-1 sm:basis-auto">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente"
            className="h-9 pl-9"
          />
        </div>

        <div className="order-3 flex basis-full flex-col gap-2 sm:basis-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 sm:shrink-0">
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:contents">
            <Dialog open={sortOpen} onOpenChange={setSortOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5">
                  <ArrowUpDown className="size-4" /> Ordenar por
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
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
                      {sortOrder === value && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5 px-2.5">
                  <Filter className="size-4" /> Filtros
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[min(92vh,48rem)] max-w-2xl overflow-y-auto rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
                <DialogHeader>
                  <DialogTitle>Filtros</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 pt-2">
                  {[
                    {
                      label: "Productos comprados en tiendas",
                      open: storeOpen,
                      setOpen: setStoreOpen,
                      selected: storeFilter,
                      setSelected: setStoreFilter,
                      options: storeOptions,
                    },
                    {
                      label: "Tipo cliente",
                      open: typeOpen,
                      setOpen: setTypeOpen,
                      selected: typeFilter,
                      setSelected: setTypeFilter,
                      options: [
                        ["customer", "Clientes"],
                        ["guest", "Invitados"],
                      ] as const,
                    },
                  ].map((section) => (
                    <div key={section.label} className="space-y-3">
                      <button
                        type="button"
                        onClick={() => section.setOpen((current) => !current)}
                        className="flex items-center gap-2 text-sm font-medium"
                        aria-expanded={section.open}
                      >
                        <span>{section.label}</span>
                        {section.selected.length > 0 && (
                          <Badge variant="secondary">{section.selected.length}</Badge>
                        )}
                        {section.open ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                      {section.open && (
                        <div className="space-y-2.5">
                          {[...[["all", "Todos"] as const], ...section.options].map(
                            ([value, label]) => (
                              <label
                                key={value}
                                className="flex cursor-pointer items-start gap-3 text-sm"
                              >
                                <Checkbox
                                  checked={
                                    value === "all"
                                      ? section.selected.length === 0
                                      : section.selected.includes(value)
                                  }
                                  onCheckedChange={(checked) =>
                                    section.setSelected(
                                      toggleSelection(
                                        section.selected,
                                        value,
                                        checked === true,
                                        section.options.map(([option]) => option),
                                      ),
                                    )
                                  }
                                />
                                <span className="font-medium">{label}</span>
                              </label>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSpentOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={spentOpen}
                    >
                      <span>Total gastado</span>
                      {spentOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    {spentOpen && (
                      <div className="space-y-3">
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
                                        : current.filter((item) => item !== currency),
                                  )
                                }
                              />
                              <span className="font-medium">
                                {currency === "ARS" ? "$ (ARS)" : "USD (Dólar)"}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
                          <label className="flex items-center gap-2">
                            <span>
                              Desde{" "}
                              {currencyFilter.length === 2
                                ? "$/USD"
                                : currencyFilter[0] === "USD"
                                  ? "USD"
                                  : "$"}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              max={spentLimit}
                              value={spentMin}
                              onChange={(event) =>
                                setSpentMin(
                                  Math.min(Math.max(0, Number(event.target.value) || 0), spentMax),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <span>
                              Hasta{" "}
                              {currencyFilter.length === 2
                                ? "$/USD"
                                : currencyFilter[0] === "USD"
                                  ? "USD"
                                  : "$"}
                            </span>
                            <Input
                              type="number"
                              min={0}
                              max={spentLimit}
                              value={spentMax}
                              onChange={(event) =>
                                setSpentMax(
                                  Math.max(
                                    Math.min(spentLimit, Number(event.target.value) || 0),
                                    spentMin,
                                  ),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                        </div>
                        <Slider
                          min={0}
                          max={spentLimit}
                          step={Math.max(1, Math.round(spentLimit / 100))}
                          value={[spentMin, spentMax]}
                          onValueChange={(value) => {
                            setSpentMin(value[0] ?? 0);
                            setSpentMax(value[1] ?? spentLimit);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setOrdersOpen((current) => !current)}
                      className="flex items-center gap-2 text-sm font-medium"
                      aria-expanded={ordersOpen}
                    >
                      <span>Total de pedidos</span>
                      {ordersOpen ? (
                        <ChevronUp className="size-4" />
                      ) : (
                        <ChevronDown className="size-4" />
                      )}
                    </button>
                    {ordersOpen && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
                          <label className="flex items-center gap-2">
                            <span>Desde</span>
                            <Input
                              type="number"
                              min={0}
                              max={ordersLimit}
                              value={ordersMin}
                              onChange={(event) =>
                                setOrdersMin(
                                  Math.min(Math.max(0, Number(event.target.value) || 0), ordersMax),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                          <label className="flex items-center gap-2">
                            <span>Hasta</span>
                            <Input
                              type="number"
                              min={0}
                              max={ordersLimit}
                              value={ordersMax}
                              onChange={(event) =>
                                setOrdersMax(
                                  Math.max(
                                    Math.min(ordersLimit, Number(event.target.value) || 0),
                                    ordersMin,
                                  ),
                                )
                              }
                              className="h-8 w-24"
                            />
                          </label>
                        </div>
                        <Slider
                          min={0}
                          max={ordersLimit}
                          step={1}
                          value={[ordersMin, ordersMax]}
                          onValueChange={(value) => {
                            setOrdersMin(value[0] ?? 0);
                            setOrdersMax(value[1] ?? ordersLimit);
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-4">
                    <p className="text-xs text-muted-foreground">
                      {filteredCustomers.length} clientes encontrados
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

          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:contents">
            <Button
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700"
              onClick={() => {
                const rows: (string | number)[][] = [
                  ["Cliente", "Email", "Total de pedidos", "Total gastado"],
                ];

                for (const c of visibleCustomers) {
                  const total = c.orders.reduce((s, o) => s + (o.total || 0), 0);
                  const gasto = new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    minimumFractionDigits: 0,
                  }).format(total);

                  rows.push([c.name ?? "", c.email ?? "", String(c.orders.length), gasto]);
                }

                const worksheet = XLSX.utils.aoa_to_sheet(rows);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
                const date = new Date().toISOString().slice(0, 10);
                const pageSuffix = page + 1;
                XLSX.writeFile(workbook, `clientes_pedidos_${date}_page-${pageSuffix}.xlsx`);
              }}
            >
              <Sheet className="size-4" />
              Exportar Excel
            </Button>

            <Button
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700"
              onClick={() => {
                const rows = visibleCustomers.map((customer) => {
                  const total = customer.orders.reduce((s, o) => s + (o.total || 0), 0);
                  const gasto = new Intl.NumberFormat("es-AR", {
                    style: "currency",
                    currency: "ARS",
                    minimumFractionDigits: 0,
                  }).format(total);

                  return [
                    customer.name ?? "",
                    customer.email ?? "",
                    String(customer.orders.length),
                    gasto,
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
                    <h2>Listado de clientes</h2>
                    <table>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Email</th>
                          <th>Total de pedidos</th>
                          <th>Total gastado</th>
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
                const pageSuffix = page + 1;
                printWindow.document.title = `clientes_pedidos_${date}_page-${pageSuffix}`;
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

      <FilterChipList chips={filterChips} />
      <div className="glass-panel mt-4 w-full max-w-full rounded-2xl">
        <Table
          containerClassName="overflow-x-auto overflow-y-visible"
          className="w-full text-sm [&_td]:align-middle [&_th]:align-middle [&_td]:py-3 [&_th]:py-3 [&_td]:text-center [&_th]:text-center"
        >
          <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-center [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Total de pedidos</TableHead>
              <TableHead>Total gastado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCustomers.map((c) => {
              const totalSpent = c.orders.reduce((s, o) => s + (o.total || 0), 0);
              return <CustomerRow key={c.key} customer={c} totalSpent={totalSpent} />;
            })}
            {filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-center text-sm text-muted-foreground">
                  No se encontraron clientes.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
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
          {visibleCustomers.length} de {filteredCustomers.length} clientes mostrados
        </p>
      </div>
    </main>
  );
}

function formatPurchaseDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : value;
}

function CustomerRow({
  customer,
  totalSpent,
}: {
  customer: { key: string; name: string; email: string; isGuest: boolean; orders: Order[] };
  totalSpent: number;
}) {
  const [open, setOpen] = useState(false);
  const [documentsOrder, setDocumentsOrder] = useState<Order | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<OrderAttachment[]>([]);
  const navigate = useNavigate();

  return (
    <>
      <TableRow key={customer.key}>
        <TableCell>
          <div className="flex items-center justify-center gap-2">
            {customer.name}
            {customer.isGuest && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                Invitado
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>{customer.email}</TableCell>
        <TableCell>{customer.orders.length}</TableCell>
        <TableCell>
          {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
            totalSpent,
          )}
        </TableCell>
        <TableCell>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {open ? "Ocultar" : "Detalles"}
          </button>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow>
          <TableCell colSpan={5} className="p-2">
            <div className="mx-auto w-fit max-w-full space-y-2">
              {customer.orders.map((o) => (
                <div
                  key={o.id}
                  className="flex w-fit max-w-full items-center justify-between rounded-md border p-2 text-sm"
                >
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => navigate({ to: "/admin/pedidos", search: { pedido: o.id } })}
                    >
                      {o.id}
                    </button>
                    <div className="text-xs text-muted-foreground">
                      Fecha de compra: {formatPurchaseDate(o.date)}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDocumentsOrder(o);
                        setPendingAttachments([]);
                      }}
                    >
                      <Paperclip className="size-3.5" /> Documentos
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}

      <Dialog
        open={documentsOrder !== null}
        onOpenChange={(value) => {
          if (!value) {
            setDocumentsOrder(null);
            setPendingAttachments([]);
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-3xl border border-border/60 bg-background p-5 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Documentos del pedido</DialogTitle>
            <DialogDescription>{documentsOrder?.id}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 border-b border-border/60 pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDocumentsOrder(null);
                setPendingAttachments([]);
              }}
            >
              <X className="size-4" /> Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!documentsOrder || pendingAttachments.length === 0) return;
                const updatedOrder = {
                  ...documentsOrder,
                  attachments: [...(documentsOrder.attachments ?? []), ...pendingAttachments],
                };
                saveOrders(
                  ordersData.map((order) => (order.id === updatedOrder.id ? updatedOrder : order)),
                );
                setDocumentsOrder(updatedOrder);
                setPendingAttachments([]);
              }}
              disabled={pendingAttachments.length === 0}
            >
              <Save className="size-4" /> Guardar
            </Button>
          </div>
          <div className="space-y-2">
            {[...(documentsOrder?.attachments ?? []), ...pendingAttachments].map((attachment) => (
              <div
                key={`${attachment.name}-${attachment.size}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm"
              >
                <span className="min-w-0 truncate">{attachment.name}</span>
                {attachment.dataUrl ? (
                  <a
                    href={attachment.dataUrl}
                    download={attachment.name}
                    className="rounded p-1 hover:bg-accent"
                    title="Descargar"
                  >
                    <Download className="size-4" />
                  </a>
                ) : null}
              </div>
            ))}
            {(documentsOrder?.attachments ?? []).length === 0 &&
              pendingAttachments.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay documentos adjuntos.</p>
              )}
          </div>
          <Input
            type="file"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              files.forEach((file) => {
                const reader = new FileReader();
                reader.onload = () =>
                  setPendingAttachments((current) => [
                    ...current,
                    {
                      name: file.name,
                      type: file.type,
                      size: file.size,
                      dataUrl: String(reader.result ?? ""),
                    },
                  ]);
                reader.readAsDataURL(file);
              });
              event.target.value = "";
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
