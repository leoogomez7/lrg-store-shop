import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brandList, brands } from "@/config/brands";
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

  const total = orders.reduce((sum, order) => sum + order.total, 0);
  const revenueSeries = revenue.map((entry) => ({
    month: entry.month,
    total: entry.arcade + entry.scents + entry.webDesign,
  }));
  const maxRevenue = Math.max(...revenueSeries.map((entry) => entry.total));
  const lowStock = products.filter((product) => product.stock <= 5);

  const cards = [
    { label: "Ingresos totales", value: formatPrice(total), icon: DollarSign },
    { label: "Pedidos", value: formatNumber(orders.length), icon: ShoppingCart },
    { label: "Productos activos", value: formatNumber(products.length), icon: Package },
    {
      label: "Ticket promedio",
      value: formatPrice(Math.round(total / Math.max(orders.length, 1))),
      icon: TrendingUp,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Panel admin</p>
      <h1 className="mt-2 text-3xl font-semibold">Dashboard general</h1>

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
          <div className="mt-8 flex h-56 items-end gap-3">
            {revenueSeries.map((entry) => (
              <div key={entry.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[0.65rem] text-muted-foreground">
                  {formatPrice(entry.total)}
                </span>
                <div
                  className="gradient-brand w-full rounded-t-lg transition-all"
                  style={{ height: `${Math.max((entry.total / maxRevenue) * 100, 6)}%` }}
                />
                <span className="text-xs text-muted-foreground">{entry.month}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h2 className="font-display font-semibold">Productos por sector</h2>
          <ul className="mt-6 space-y-4">
            {brandList.map((brand) => {
              const count = products.filter((product) => product.brand === brand.slug).length;
              return (
                <li key={brand.slug}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{brand.shortName}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="gradient-brand h-full rounded-full"
                      style={{ width: `${(count / products.length) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
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
              {orders.slice(0, 6).map((order) => (
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
            Stock crítico
          </h2>
          <ul className="divide-y divide-border/60">
            {lowStock.slice(0, 8).map((product) => (
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
        </div>
      </section>
    </main>
  );
}
