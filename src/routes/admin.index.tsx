import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
      { title: "Dashboard — Admin LRG Store Shop" },
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

  let revenueSeries: { month: string; total: number; _date?: Date }[] = [];

  if (filteredOrders.length > 0) {
    const map = new Map<string, { month: string; total: number; date: Date }>();
    for (const o of filteredOrders) {
      const d = new Date(o.date);
      const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const existing = map.get(key);
      if (existing) existing.total += o.total;
      else map.set(key, { month: key, total: o.total, date: d });
    }
    revenueSeries = Array.from(map.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((e) => ({ month: e.month, total: e.total }));
  } else {
    // Fallback to static revenue data (use month -> MM/YYYY conversion)
    revenueSeries = revenue.map((entry) => ({
      month: fallbackMonthToMMYYYY(entry.month),
      total:
        ecosystem === "todos"
          ? entry.arcade + entry.scents + entry.webDesign
          : entry[revenueKeyMap[ecosystem]],
    }));
  }

  // If duplicates exist, keep the last occurrence (prefer the later entry)
  const lastSeen = new Map<string, { month: string; total: number }>();
  for (const r of revenueSeries) lastSeen.set(r.month, { month: r.month, total: r.total });
  revenueSeries = Array.from(lastSeen.values()).sort((a, b) => {
    const [am, ay] = a.month.split("/").map((s) => Number(s));
    const [bm, by] = b.month.split("/").map((s) => Number(s));
    return new Date(ay, am - 1).getTime() - new Date(by, bm - 1).getTime();
  });

  const revenueTotal = revenueSeries.reduce((sum, e) => sum + e.total, 0);

  const cards = [
    { label: "Ingresos totales", value: formatPrice(total), icon: DollarSign },
    { label: "Pedidos", value: formatNumber(filteredOrders.length), icon: ShoppingCart },
    { label: "Productos activos", value: formatNumber(filteredProducts.length), icon: Package },
    {
      label: "Ticket promedio",
      value: formatPrice(Math.round(total / Math.max(filteredOrders.length, 1))),
      icon: TrendingUp,
    },
  ];

  const lowStock = filteredProducts
    .filter((product) => product.stock <= 5)
    .sort((a, b) => a.stock - b.stock);
  const [stockPage, setStockPage] = useState(0);
  const stockPageSize = 10;
  const stockPages = Math.ceil(lowStock.length / stockPageSize);
  const currentStockItems = lowStock.slice(
    stockPage * stockPageSize,
    stockPage * stockPageSize + stockPageSize,
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Panel admin</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mt-2 text-3xl font-semibold">Dashboard general</h1>
          <p className="text-sm text-muted-foreground">Filtrá métricas por ecosistema o consultá el total.</p>
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
          <h2 className="font-display font-semibold">Ingresos por mes</h2>
            {/* Total removed per user request */}
          <div className="mt-6">
            <ul className="space-y-2">
              {revenueSeries.map((entry) => (
                <li key={entry.month} className="flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground">{entry.month}</span>
                  <span className="font-medium">{formatPrice(entry.total)}</span>
                </li>
              ))}
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
                  {product.stock} u.
                </Badge>
              </li>
            ))}
            {lowStock.length === 0 && (
              <li className="px-5 py-6 text-sm text-muted-foreground">
                Todos los productos tienen stock saludable.
              </li>
            )}
          </ul>
          {stockPages > 1 && (
            <div className="border-t border-border/60 px-5 py-4 text-right">
              <button
                type="button"
                className="text-sm font-semibold text-primary transition hover:text-primary/80"
                onClick={() => setStockPage((current) => Math.min(current + 1, stockPages - 1))}
                disabled={stockPage >= stockPages - 1}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
