import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  CreditCard,
  DollarSign,
  Package,
  Search,
  ShoppingCart,
  TrendingUp,
  Users,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { formatDate, formatNumber, formatPrice } from "@/lib/format";
import { catalogQueries, orderQueries } from "@/services/catalog.service";
import { loadSiteStats } from "@/server/persistence";

const siteStatsQuery = {
  queryKey: ["site-stats"],
  queryFn: () => loadSiteStats({ data: {} }),
};

export const Route = createFileRoute("/admin/panel")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(orderQueries.list()),
      context.queryClient.ensureQueryData(orderQueries.revenue()),
      context.queryClient.ensureQueryData(catalogQueries.all()),
      context.queryClient.ensureQueryData(siteStatsQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Administrador" },
      {
        name: "description",
        content: "Métricas de ventas, pedidos y stock de los tres sectores del negocio.",
      },
      { property: "og:title", content: "Administrador" },
      { property: "og:description", content: "Panel administrativo del negocio LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const { data: revenue } = useSuspenseQuery(orderQueries.revenue());
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const { data: siteStats } = useSuspenseQuery(siteStatsQuery);
  const [ecosystem, setEcosystem] = useState<"todos" | BrandSlug>("todos");

  const revenueKeyMap: Record<BrandSlug, "arcade" | "scents" | "webDesign"> = {
    arcade: "arcade",
    scents: "scents",
    "web-design": "webDesign",
  };

  const filteredProducts =
    ecosystem === "todos" ? products : products.filter((product) => product.brand === ecosystem);
  const filteredOrders =
    ecosystem === "todos" ? orders : orders.filter((order) => order.brand === ecosystem);

  const total = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  const deliveredOrders = filteredOrders.filter((order) => order.status === "entregado").length;
  const pendingOrders = filteredOrders.filter((order) => order.status !== "entregado").length;
  const totalCustomers = new Set(
    filteredOrders.map((order) => order.email || order.customer || order.phone || order.id),
  ).size;
  const totalProducts = filteredProducts.reduce(
    (count, product) => count + Math.max(1, product.variants?.length ?? 0),
    0,
  );
  const inactiveProducts = filteredProducts.filter((product) => product.hidden).length;
  const activeProducts = filteredProducts.filter((product) => !product.hidden).length;
  const totalExpenses = filteredOrders.reduce((sum, order) => sum + order.expenses, 0);
  const totalProfit = filteredOrders.reduce((sum, order) => sum + order.profit, 0);

  // Build revenue series from filtered orders grouped by month/year (MM/YYYY)
  const monthNameMap: Record<string, number> = {
    ene: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    abr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    aug: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dic: 12,
    dec: 12,
  };

  const fallbackMonthToMMYYYY = (shortMonth: string) => {
    const num = monthNameMap[shortMonth.toLowerCase()] || new Date().getMonth() + 1;
    return `${String(num).padStart(2, "0")}/${new Date().getFullYear()}`;
  };

  type DateRange = import("react-day-picker").DateRange;

  const [reportMetric, setReportMetric] = useState<
    "ingresos" | "gastos" | "ganancias" | "pedidosEntregados" | "pedidosSinEntregar"
  >("ingresos");
  const [selectedMonth, setSelectedMonth] = useState("todos");
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(undefined);
  const [rangePopoverOpen, setRangePopoverOpen] = useState(false);

  const reportMetricLabelMap: Record<
    "ingresos" | "gastos" | "ganancias" | "pedidosEntregados" | "pedidosSinEntregar",
    string
  > = {
    ingresos: "Ingresos por mes",
    gastos: "Gastos por mes",
    ganancias: "Ganancias por mes",
    pedidosEntregados: "Pedidos entregados por mes",
    pedidosSinEntregar: "Pedidos sin entregar por mes",
  };

  const getMetricValue = (order: (typeof filteredOrders)[number]) => {
    switch (reportMetric) {
      case "gastos":
        return order.expenses;
      case "ganancias":
        return order.profit;
      case "pedidosEntregados":
        return order.status === "entregado" ? 1 : 0;
      case "pedidosSinEntregar":
        return order.status !== "entregado" ? 1 : 0;
      default:
        return order.total;
    }
  };

  const buildMonthSeries = (ordersList: typeof filteredOrders) => {
    const map = new Map<string, { month: string; total: number; date: Date }>();
    for (const order of ordersList) {
      const d = new Date(order.date);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const existing = map.get(key);
      const value = getMetricValue(order);
      if (existing) existing.total += value;
      else map.set(key, { month: key, total: value, date: d });
    }
    return Array.from(map.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((entry) => ({ month: entry.month, total: entry.total }));
  };

  const revenueSeries = buildMonthSeries(filteredOrders);

  const reportTitle = reportMetricLabelMap[reportMetric];
  const monthOptions = revenueSeries.map((entry) => entry.month);
  const isRangeActive = Boolean(range?.from && range?.to);
  const isCountMetric =
    reportMetric === "pedidosEntregados" || reportMetric === "pedidosSinEntregar";

  const reportSeries = (() => {
    if (isRangeActive && range?.from && range?.to) {
      const startDate = range.from;
      const endDate = range.to;
      const ordersInRange = filteredOrders.filter((order) => {
        const d = new Date(order.date);
        return d >= startDate && d <= endDate;
      });
      return buildMonthSeries(ordersInRange);
    }
    if (selectedMonth !== "todos") {
      return revenueSeries.filter((entry) => entry.month === selectedMonth);
    }
    return revenueSeries;
  })();

  const reportTotal = reportSeries.reduce((sum, entry) => sum + entry.total, 0);

  const cards = [
    { label: "Ingresos", value: formatPrice(total), icon: DollarSign },
    { label: "Gastos", value: formatPrice(totalExpenses), icon: CreditCard },
    { label: "Ganancias", value: formatPrice(totalProfit), icon: TrendingUp },
    { label: "Pedidos", value: formatNumber(deliveredOrders + pendingOrders), icon: ShoppingCart },
    { label: "Pedidos entregados", value: formatNumber(deliveredOrders), icon: ShoppingCart },
    { label: "Pedidos sin entregar", value: formatNumber(pendingOrders), icon: ShoppingCart },
    { label: "Clientes", value: formatNumber(totalCustomers), icon: Users },
    { label: "Productos", value: formatNumber(totalProducts), icon: Package },
    { label: "Productos activos", value: formatNumber(activeProducts), icon: Package },
    { label: "Productos inactivos", value: formatNumber(inactiveProducts), icon: Package },
    {
      label: "Visitas totales",
      value: formatNumber(siteStats.totalVisits),
      icon: Eye,
    },
    {
      label: "Visitantes únicos",
      value: formatNumber(siteStats.uniqueVisitors),
      icon: Users,
    },
  ];

  const stockItems = filteredProducts
    .flatMap((product) =>
      product.variants?.length
        ? product.variants.map((variant) => ({
            id: `${product.id}-${variant.id}`,
            name: product.name,
            variantName: variant.name,
            category: product.category,
            brand: product.brand,
            stock: variant.stock,
          }))
        : [
            {
              id: product.id,
              name: product.name,
              variantName: undefined,
              category: product.category,
              brand: product.brand,
              stock: product.stock,
            },
          ],
    )
    .sort((a, b) => a.stock - b.stock);
  const totalStockUnits = stockItems.reduce((sum, item) => sum + item.stock, 0);
  const [stockSearch, setStockSearch] = useState("");
  const normalizedStockSearch = stockSearch.trim().toLowerCase();
  const searchedStockItems = normalizedStockSearch
    ? stockItems.filter((product) =>
        [product.name, product.category, product.brand].some((value) =>
          value.toLowerCase().includes(normalizedStockSearch),
        ),
      )
    : stockItems;
  const [stockPage, setStockPage] = useState(0);
  const [stockPageSize, setStockPageSize] = useState<number>(10);
  const [stockPageSizeInput, setStockPageSizeInput] = useState<string>("10");
  const stockPages = Math.max(1, Math.ceil(searchedStockItems.length / stockPageSize));
  const currentStockItems = searchedStockItems.slice(
    stockPage * stockPageSize,
    stockPage * stockPageSize + stockPageSize,
  );

  const recentOrders = [...filteredOrders].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersPageSize, setOrdersPageSize] = useState<number>(10);
  const [ordersPageSizeInput, setOrdersPageSizeInput] = useState<string>("10");
  const ordersPages = Math.max(1, Math.ceil(recentOrders.length / ordersPageSize));
  const currentOrders = recentOrders.slice(
    ordersPage * ordersPageSize,
    ordersPage * ordersPageSize + ordersPageSize,
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Métricas</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold">Panel Administrativo</h1>
        </div>
        <Select
          value={ecosystem}
          onValueChange={(value) => setEcosystem(value as "todos" | BrandSlug)}
        >
          <SelectTrigger className="w-55">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Total</SelectItem>
            {brandList.map((brand) => (
              <SelectItem key={brand.slug} value={brand.slug}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="glass-panel flex min-h-36.5 flex-col justify-between rounded-2xl p-4 text-left transition hover:border-border/60"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <card.icon className="size-4" />
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {card.label}
              </span>
            </div>
            <div className="mt-2">
              <p className="text-2xl font-semibold leading-tight">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-1">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold">{reportTitle}</h2>
              <p className="text-sm text-muted-foreground">
                Selecciona un tipo de reporte, un mes o un rango de fechas.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 w-full max-w-3xl">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Tipo
                </label>
                <Select
                  value={reportMetric}
                  onValueChange={(value) => {
                    setReportMetric(value as typeof reportMetric);
                    setSelectedMonth("todos");
                    setRange(undefined);
                  }}
                >
                  <SelectTrigger className="mt-2 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingresos">Ingresos por mes</SelectItem>
                    <SelectItem value="gastos">Gastos por mes</SelectItem>
                    <SelectItem value="ganancias">Ganancias por mes</SelectItem>
                    <SelectItem value="pedidosEntregados">Pedidos entregados por mes</SelectItem>
                    <SelectItem value="pedidosSinEntregar">Pedidos sin entregar por mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Mes
                </label>
                <Select
                  value={selectedMonth}
                  onValueChange={(value) => {
                    setSelectedMonth(value);
                    setRange(undefined);
                  }}
                >
                  <SelectTrigger className="mt-2 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {monthOptions.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Rango de fechas
                </label>
                <div className="mt-2">
                  <Popover
                    open={rangePopoverOpen}
                    onOpenChange={(open) => {
                      setRangePopoverOpen(open);
                      if (open) setDraftRange(range);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-9 w-full justify-between gap-2 rounded-xl border border-input bg-transparent px-3 py-2 text-left text-sm font-normal shadow-sm hover:bg-transparent hover:text-foreground"
                        onClick={() => setSelectedMonth("todos")}
                      >
                        <span>
                          {range?.from && range?.to
                            ? `${formatDate(range.from.toISOString())} - ${formatDate(range.to.toISOString())}`
                            : range?.from
                              ? `${formatDate(range.from.toISOString())} - dd/mm/aaaa`
                              : "Seleccionar rango"}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-88 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Fecha inicial
                          </label>
                          <Input
                            type="date"
                            value={
                              draftRange?.from ? draftRange.from.toISOString().slice(0, 10) : ""
                            }
                            onChange={(event) => {
                              const from = event.target.value
                                ? new Date(`${event.target.value}T00:00:00`)
                                : undefined;
                              setDraftRange((current) => ({ from, to: current?.to }));
                            }}
                            className="[&::-webkit-calendar-picker-indicator]:invert"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">
                            Fecha final
                          </label>
                          <Input
                            type="date"
                            value={draftRange?.to ? draftRange.to.toISOString().slice(0, 10) : ""}
                            min={
                              draftRange?.from
                                ? draftRange.from.toISOString().slice(0, 10)
                                : undefined
                            }
                            onChange={(event) => {
                              const to = event.target.value
                                ? new Date(`${event.target.value}T00:00:00`)
                                : undefined;
                              setDraftRange((current) => ({ from: current?.from, to }));
                            }}
                            className="[&::-webkit-calendar-picker-indicator]:invert"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center gap-1.5 border-t border-border/60 p-3">
                        <Button
                          variant="ghost"
                          className="w-auto px-4"
                          onClick={() => setDraftRange(undefined)}
                        >
                          Limpiar
                        </Button>
                        <Button
                          className="w-auto px-4"
                          onClick={() => {
                            setRange(draftRange);
                            setSelectedMonth("todos");
                            setRangePopoverOpen(false);
                          }}
                        >
                          Aplicar
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl bg-surface/80 p-4 text-sm text-muted-foreground">
              Total:{" "}
              <span className="font-semibold text-foreground">
                {isCountMetric ? formatNumber(reportTotal) : formatPrice(reportTotal)}
              </span>
            </div>
            <ul className="space-y-2">
              {reportSeries.length === 0 ? (
                <li className="rounded-2xl border border-border/60 bg-background p-4 text-sm text-muted-foreground">
                  No hay datos para el filtro seleccionado.
                </li>
              ) : (
                reportSeries.map((entry) => (
                  <li
                    key={entry.month}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm"
                  >
                    <span className="text-xs text-muted-foreground">{entry.month}</span>
                    <span className="font-medium">
                      {isCountMetric ? formatNumber(entry.total) : formatPrice(entry.total)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        {/* Sectores ya están resumidos en las tarjetas. */}
      </section>

      <section className="mt-8 grid gap-6 pb-20">
        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 p-5">
            <h2 className="font-display font-semibold">Últimos pedidos</h2>
          </div>
          <Table className="w-full text-center [&_td]:text-center [&_th]:text-center">
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  <TableCell>{brands[order.brand].shortName}</TableCell>
                  <TableCell>{formatDate(order.date)}</TableCell>
                  <TableCell>{formatPrice(order.total)}</TableCell>
                </TableRow>
              ))}
              {recentOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No hay pedidos disponibles.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <div className="border-t border-border/60 bg-background/30 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {currentOrders.length} de {recentOrders.length} pedidos mostrados
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar</span>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={ordersPageSizeInput}
                    onChange={(e) => setOrdersPageSizeInput(e.target.value)}
                    className="h-8 w-20 bg-background/50"
                  />
                  {(() => {
                    const v = Number(ordersPageSizeInput);
                    const isValid = Number.isFinite(v) && v >= 1;
                    const isChanged =
                      ordersPageSizeInput !== "" &&
                      String(Math.floor(v)) !== String(ordersPageSize);
                    return (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!isValid || !isChanged) return;
                          const final = Math.min(1000, Math.floor(v));
                          setOrdersPageSize(final);
                          setOrdersPage(0);
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOrdersPage(0)}
                    disabled={ordersPage === 0 || ordersPages === 0}
                    className="h-9 rounded-full border-0 bg-[#111827] px-4 text-white shadow-none hover:bg-[#1f2937]"
                  >
                    Principio
                  </Button>
                  <div className="flex items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
                    {Array.from({ length: Math.max(ordersPages, 1) }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={`rounded-full border-0 px-3 py-1 outline-none transition-colors focus-visible:outline-none ${index === ordersPage ? "bg-[#111827] text-white shadow-none" : "bg-transparent text-muted-foreground hover:bg-surface-2"}`}
                        onClick={() => setOrdersPage(index)}
                        disabled={ordersPages === 0}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOrdersPage(ordersPages - 1)}
                    disabled={ordersPage >= ordersPages - 1 || ordersPages === 0}
                    className="h-9 rounded-full border-0 bg-[#111827] px-4 text-white shadow-none hover:bg-[#1f2937]"
                  >
                    Último
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel overflow-hidden rounded-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 p-5">
            <div className="flex items-center gap-3">
              <h2 className="font-display font-semibold">Stock total</h2>
              <span className="rounded-full bg-secondary/60 px-3 py-1 text-sm font-medium text-foreground">
                {formatNumber(totalStockUnits)} total
              </span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={stockSearch}
                onChange={(event) => {
                  setStockSearch(event.target.value);
                  setStockPage(0);
                }}
                placeholder="Buscar productos..."
                aria-label="Buscar productos en stock"
                className="pl-9"
              />
            </div>
          </div>
          <ul className="divide-y divide-border/60">
            {currentStockItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <span className="min-w-0 truncate">{item.name}</span>
                  {item.variantName ? (
                    <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                      {item.variantName}
                    </span>
                  ) : null}
                </span>
                <Badge variant={item.stock === 0 ? "destructive" : "secondary"}>
                  {item.stock} unidades
                </Badge>
              </li>
            ))}
            {searchedStockItems.length === 0 ? (
              <li className="flex min-h-[200px] items-center justify-center px-5 py-6 text-center text-sm text-muted-foreground">
                {normalizedStockSearch
                  ? "No se encontraron productos."
                  : "No hay productos disponibles."}
              </li>
            ) : null}
          </ul>
          <div className="border-t border-border/60 bg-background/30 px-5 py-4">
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {currentStockItems.length} de {searchedStockItems.length} productos mostrados
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Mostrar</span>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={stockPageSizeInput}
                    onChange={(e) => setStockPageSizeInput(e.target.value)}
                    className="h-8 w-20 bg-background/50"
                  />
                  {(() => {
                    const v = Number(stockPageSizeInput);
                    const isValid = Number.isFinite(v) && v >= 1;
                    const isChanged =
                      stockPageSizeInput !== "" &&
                      String(Math.floor(v)) !== String(stockPageSize);
                    return (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (!isValid || !isChanged) return;
                          const final = Math.min(1000, Math.floor(v));
                          setStockPageSize(final);
                          setStockPage(0);
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStockPage(0)}
                    disabled={stockPage === 0 || stockPages === 0}
                    className="h-9 rounded-full border-0 bg-[#111827] px-4 text-white shadow-none hover:bg-[#1f2937]"
                  >
                    Principio
                  </Button>
                  <div className="flex flex-wrap items-center gap-1 rounded-full bg-transparent px-3 py-1 text-sm text-foreground">
                    {Array.from({ length: Math.max(stockPages, 1) }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={`rounded-full border-0 px-3 py-1 outline-none transition-colors focus-visible:outline-none ${index === stockPage ? "bg-[#111827] text-white shadow-none" : "bg-transparent text-muted-foreground hover:bg-surface-2"}`}
                        onClick={() => setStockPage(index)}
                        disabled={stockPages === 0}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStockPage(stockPages - 1)}
                    disabled={stockPage >= stockPages - 1 || stockPages === 0}
                    className="h-9 rounded-full border-0 bg-[#111827] px-4 text-white shadow-none hover:bg-[#1f2937]"
                  >
                    Último
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
