import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { brands } from "@/config/brands";
import { formatDate, formatPrice } from "@/lib/format";
import { orderQueries } from "@/services/catalog.service";
import type { BrandSlug } from "@/config/brands";
import type { OrderStatus } from "@/data/orders";

const statuses: (OrderStatus | "todos")[] = [
  "todos",
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
];

const brandsFilter: (BrandSlug | "todos")[] = ["todos", "arcade", "scents", "web-design"];

type OrderSort =
  | "customer_asc"
  | "customer_desc"
  | "date_desc"
  | "date_asc"
  | "total_desc"
  | "total_asc";

const statusVariant: Record<OrderStatus, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  pendiente: "outline",
  pagado: "success",
  enviado: "warning",
  entregado: "default",
  cancelado: "destructive",
};

export const Route = createFileRoute("/admin/pedidos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  head: () => ({
    meta: [
      { title: "Pedidos — Admin LRG Store Shop" },
      {
        name: "description",
        content: "Seguimiento de pedidos de los tres sectores con estados y detalle de items.",
      },
      { property: "og:title", content: "Pedidos — Admin LRG Store Shop" },
      { property: "og:description", content: "Gestión de pedidos del ecosistema LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminOrders,
});

function AdminOrders() {
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const [status, setStatus] = useState<OrderStatus | "todos">("todos");
  const [brand, setBrand] = useState<BrandSlug | "todos">("todos");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<OrderSort>("customer_asc");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const results = useMemo(() => {
    const filtered = orders.filter((order) => {
      const statusMatches = status === "todos" || order.status === status;
      const brandMatches = brand === "todos" || order.brand === brand;
      const queryMatches =
        !query ||
        order.id.toLowerCase().includes(query.toLowerCase()) ||
        order.customer.toLowerCase().includes(query.toLowerCase()) ||
        order.email.toLowerCase().includes(query.toLowerCase());

      return statusMatches && brandMatches && queryMatches;
    });

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
        default:
          return 0;
      }
    });
  }, [orders, status, brand, query, sortOrder]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Operaciones</p>
          <h1 className="mt-2 text-3xl font-semibold">Pedidos</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pedido, cliente o email"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus | "todos")}>
            <SelectTrigger className="w-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "todos" ? "Todos los estados" : item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={brand} onValueChange={(value) => setBrand(value as BrandSlug | "todos")}> 
            <SelectTrigger className="w-55">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {brandsFilter.map((item) => (
                <SelectItem key={item} value={item}>
                  {item === "todos" ? "Todos los sectores" : brands[item].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as OrderSort)}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer_asc">Cliente A-Z</SelectItem>
              <SelectItem value="customer_desc">Cliente Z-A</SelectItem>
              <SelectItem value="date_desc">Fecha más reciente</SelectItem>
              <SelectItem value="date_asc">Fecha más antigua</SelectItem>
              <SelectItem value="total_desc">Total mayor a menor</SelectItem>
              <SelectItem value="total_asc">Total menor a mayor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass-panel mt-8 overflow-x-auto rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              return (
                <>
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                      <span className="block">{order.customer}</span>
                      <span className="text-xs text-muted-foreground">{order.email}</span>
                    </TableCell>
                    <TableCell>{brands[order.brand].shortName}</TableCell>
                    <TableCell>{formatDate(order.date)}</TableCell>
                    <TableCell>
                      <Badge className="capitalize" variant={statusVariant[order.status]}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        className="rounded-lg border border-border px-3 py-1 text-sm transition hover:bg-surface-2"
                      >
                        {isExpanded ? "Ocultar" : "Mostrar"}
                      </button>
                    </TableCell>
                  </TableRow>

                  {isExpanded && (
                    <TableRow key={`${order.id}-details`}>
                      <TableCell colSpan={7} className="bg-surface-2/70 p-5">
                        <div className="space-y-3 text-sm">
                          <p className="font-medium">Detalle del pedido</p>
                          <ul className="space-y-2 text-sm">
                            {order.items.map((item) => (
                              <li key={item.name} className="flex items-center justify-between gap-4 rounded-xl bg-surface p-3">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.quantity} × {formatPrice(item.price)}
                                  </p>
                                </div>
                                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
