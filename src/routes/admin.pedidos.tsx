import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { brands } from "@/config/brands";
import { formatDate, formatPrice } from "@/lib/format";
import { orderQueries } from "@/services/catalog.service";
import type { OrderStatus } from "@/data/orders";

const statuses: (OrderStatus | "todos")[] = [
  "todos",
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
];

const statusVariant: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  pagado: "secondary",
  enviado: "default",
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

  const results = useMemo(
    () => (status === "todos" ? orders : orders.filter((order) => order.status === status)),
    [orders, status],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Operaciones</p>
          <h1 className="mt-2 text-3xl font-semibold">Pedidos</h1>
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as OrderStatus | "todos")}>
          <SelectTrigger className="w-[200px]">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.id}</TableCell>
                <TableCell>
                  <span className="block">{order.customer}</span>
                  <span className="text-xs text-muted-foreground">{order.email}</span>
                </TableCell>
                <TableCell>{brands[order.brand].shortName}</TableCell>
                <TableCell>{formatDate(order.date)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[order.status]}>{order.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section className="mt-10 pb-20">
        <h2 className="font-display text-lg font-semibold">Detalle de pedidos</h2>
        <Accordion type="single" collapsible className="glass-panel mt-4 rounded-2xl px-5">
          {results.map((order) => (
            <AccordionItem key={order.id} value={order.id}>
              <AccordionTrigger>
                {order.id} · {order.customer} · {formatPrice(order.total)}
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm">
                  {order.items.map((item) => (
                    <li key={item.name} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {item.quantity} × {item.name}
                      </span>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </main>
  );
}
