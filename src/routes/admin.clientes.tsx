import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { orderQueries, type Order } from "@/services/catalog.service";
import { useMemo, useState } from "react";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/admin/clientes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  head: () => ({ meta: [{ title: "Clientes — Admin LRG Store Shop" }] }),
  component: AdminClients,
});

function AdminClients() {
  const { data: orders = [] } = useSuspenseQuery(orderQueries.list());

  type Customer = { key: string; name: string; email: string; orders: Order[] };

  const customers = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const o of orders) {
      const key = o.email || o.customer || o.phone || o.id;
      if (!map.has(key)) {
        map.set(key, { key, name: o.customer, email: o.email, orders: [] });
      }
      map.get(key)!.orders.push(o);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Clientes</p>
          <h1 className="mt-2 text-3xl font-semibold">Listado de clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button className="text-white inline-flex items-center" 
            onClick={() => {
              // build CSV: one row per order with customer info
              const header = [
                "customerName",
                "email",
                "orderId",
                "date",
                "total",
                "shippingMethod",
                "itemsCount",
              ];
              const rows: string[][] = [header];
              for (const c of customers) {
                for (const o of c.orders) {
                  rows.push([
                    c.name ?? "",
                    c.email ?? "",
                    o.id,
                    o.date,
                    String(o.total ?? ""),
                    o.shippingMethod ?? o.paymentMethod ?? "",
                    String((o.items || []).reduce((s, it) => s + (it.quantity || 0), 0)),
                  ]);
                }
              }

              const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `clientes_pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            }}
            >
            <Upload className="size-4" />
            <span className="ml-2">Exportar CSV</span>
          </Button>
        </div>
      </div>

      <div className="glass-panel overflow-x-auto rounded-2xl pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Pedidos</TableHead>
              <TableHead>Total gastado</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const totalSpent = c.orders.reduce((s, o) => s + (o.total || 0), 0);
              return (
                <CustomerRow key={c.key} customer={c} totalSpent={totalSpent} />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

function CustomerRow({ customer, totalSpent }: { customer: { key: string; name: string; email: string; orders: Order[] }; totalSpent: number }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow key={customer.key}>
        <TableCell>{customer.name}</TableCell>
        <TableCell>{customer.email}</TableCell>
        <TableCell>{customer.orders.length}</TableCell>
        <TableCell>{new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(totalSpent)}</TableCell>
        <TableCell>
          <button className="text-sm text-primary underline" onClick={() => setOpen((v) => !v)}>
            {open ? "Ocultar" : "Mostrar"}
          </button>
        </TableCell>
      </TableRow>

      {open && (
        <TableRow>
          <TableCell colSpan={5} className="p-3">
            <div className="space-y-3">
              {customer.orders.map((o) => (
                <div key={o.id} className="rounded-md border p-2 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="font-medium">{o.id}</div>
                    <div className="text-xs text-muted-foreground">{o.date}</div>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-4">
                    <div>Método pago: {o.paymentMethod ?? "-"}</div>
                    <div>Envío: {o.shippingMethod ?? "-"}</div>
                    <div>Gasto: {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(o.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
