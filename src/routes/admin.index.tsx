import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

export const Route = createFileRoute("/admin/")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(orderQueries.list()),
      context.queryClient.ensureQueryData(orderQueries.revenue()),
      context.queryClient.ensureQueryData(catalogQueries.all()),
    ]);
  },
  head: () => ({
    meta: [
      { title: "LRG Store Shop" },
      {
        name: "description",
        content: "Métricas de ventas, pedidos y stock de los tres sectores del ecosistema.",
      },
      { property: "og:title", content: "Dashboard — Admin LRG Store Shop" },
      { property: "og:description", content: "Panel administrativo del ecosistema LRG." },
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

  const getMetricValue = (order: typeof filteredOrders[number]) => {
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
  const isCountMetric = reportMetric === "pedidosEntregados" || reportMetric === "pedidosSinEntregar";

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
    { label: "Pedidos entregados", value: formatNumber(deliveredOrders), icon: ShoppingCart },
    { label: "Pedidos sin entregar", value: formatNumber(pendingOrders), icon: ShoppingCart },
    { label: "Productos activos", value: formatNumber(activeProducts), icon: Package },
    { label: "Productos inactivos", value: formatNumber(inactiveProducts), icon: Package },
  ];

  const stockItems = filteredProducts.sort((a, b) => a.stock - b.stock);
  const [stockPage, setStockPage] = useState(0);
  const stockPageSize = 10;
  const stockPages = Math.max(1, Math.ceil(stockItems.length / stockPageSize));
  const currentStockItems = stockItems.slice(
    stockPage * stockPageSize,
    stockPage * stockPageSize + stockPageSize,
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Métricas</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold">Panel administrativo</h1>
        </div>
        <Select value={ecosystem} onValueChange={(value) => setEcosystem(value as "todos" | BrandSlug)}>
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="glass-panel rounded-2xl p-5">
            <span className="gradient-brand grid size-9 place-items-center rounded-lg">
              <card.icon className="size-4 text-primary-foreground" />
            </span>
            <p className="mt-4 text-xs text-muted-foreground">{card.label}</p>
            <p className="font-display mt-1 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold">{reportTitle}</h2>
              <p className="text-sm text-muted-foreground">Selecciona un tipo de reporte, un mes o un rango de fechas.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 w-full max-w-3xl">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Tipo
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={reportMetric}
                  onChange={(event) => {
                    setReportMetric(event.target.value as typeof reportMetric);
                    setSelectedMonth("todos");
                    setRange(undefined);
                  }}
                >
                  <option value="ingresos">Ingresos por mes</option>
                  <option value="gastos">Gastos por mes</option>
                  <option value="ganancias">Ganancias por mes</option>
                  <option value="pedidosEntregados">Pedidos entregados por mes</option>
                  <option value="pedidosSinEntregar">Pedidos sin entregar por mes</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Mes
                </label>
                <select
                  className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={selectedMonth}
                  onChange={(event) => {
                    setSelectedMonth(event.target.value);
                    setRange(undefined);
                  }}
                >
                  <option value="todos">Todos</option>
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Rango de fechas
                </label>
                <div className="mt-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-between text-left"
                        onClick={() => setSelectedMonth("todos")}
                      >
                        {range && range.from && range.to
                          ? `${formatDate(range.from.toISOString())} - ${formatDate(range.to.toISOString())}`
                          : range && range.from
                          ? `${formatDate(range.from.toISOString())}`
                          : "Seleccionar rango"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-88 p-0">
                      <Calendar
                        mode="range"
                        selected={range}
                        onSelect={(value) => {
                          setRange(value as DateRange | undefined);
                          setSelectedMonth("todos");
                        }}
                      />
                      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-background p-3">
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => setRange(undefined)}
                        >
                          Limpiar
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
              Total: <span className="font-semibold text-foreground">
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
                  <li key={entry.month} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background px-4 py-3 text-sm">
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

      <section className="mt-8 grid gap-6 pb-20 lg:grid-cols-2">
        <div className="glass-panel overflow-hidden rounded-2xl">
          <h2 className="font-display border-b border-border/60 p-5 font-semibold">
            Últimos pedidos
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.slice(0, 6).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.id}</TableCell>
                  <TableCell>{brands[order.brand].shortName}</TableCell>
                  <TableCell>{formatDate(order.date)}</TableCell>
                  <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="glass-panel overflow-hidden rounded-2xl">
          <h2 className="font-display border-b border-border/60 p-5 font-semibold">
            Stock total
          </h2>
          <ul className="divide-y divide-border/60">
            {currentStockItems.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>
                <Badge variant={product.stock === 0 ? "destructive" : "secondary"}>
                  {product.stock} unidades
                </Badge>
              </li>
            ))}
            {stockItems.length === 0 ? (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                No hay productos disponibles.
              </li>
            ) : null}
          </ul>
          {stockItems.length > 0 && (
            <div className="border-t border-border/60 px-5 py-4">
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {currentStockItems.length} de {stockItems.length} productos mostrados
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStockPage(0)}
                    disabled={stockPage === 0}
                  >
                    Principio
                  </Button>
                  <div className="flex flex-wrap items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm">
                    {Array.from({ length: stockPages }, (_, index) => (
                      <button
                        key={index}
                        type="button"
                        className={`rounded-full px-3 py-1 ${index === stockPage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-slate-100"}`}
                        onClick={() => setStockPage(index)}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStockPage(stockPages - 1)}
                    disabled={stockPage >= stockPages - 1}
                  >
                    Último
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
