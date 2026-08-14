import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { orderQueries, type Order } from "@/services/catalog.service";
import { useMemo, useState } from "react";
import { Check, Eye, EyeOff, Sheet, FileText, Search } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/admin/clientes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  head: () => ({ meta: [{ title: "LRG Store Shop - Administrador" }] }),
  component: AdminClients,
});

function AdminClients() {
  const { data: orders = [] } = useSuspenseQuery(orderQueries.list());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageSizeInput, setPageSizeInput] = useState<string>("10");
  const [query, setQuery] = useState("");

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

  const filteredCustomers = useMemo(() => {
    if (!query) return customers;
    const q = query.toLowerCase();
    return customers.filter((c) => {
      const name = (c.name ?? "").toLowerCase();
      const email = (c.email ?? "").toLowerCase();
      const key = (c.key ?? "").toLowerCase();
      return name.includes(q) || email.includes(q) || key.includes(q);
    });
  }, [customers, query]);

  const visibleCustomers = useMemo(() => {
    if (!pageSize || pageSize <= 0) return [] as typeof customers;
    return filteredCustomers.slice(page * pageSize, page * pageSize + pageSize);
  }, [filteredCustomers, page, pageSize]);
  const totalPages = pageSize && pageSize > 0 ? Math.max(1, Math.ceil(filteredCustomers.length / pageSize)) : 1;
  const hasNextPage = page + 1 < totalPages;
  const hasPreviousPage = page > 0;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-55">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Clientes</p>
          <h1 className="mt-2 text-3xl font-semibold">Listado de clientes</h1>
        </div>

        <div className="relative min-w-55 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cliente" className="h-9 pl-9" />
        </div>

        <div className="flex items-center gap-2">
          <Button
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-black shadow-none hover:bg-primary/90"
            onClick={() => {
              const rows: (string | number)[][] = [["Cliente", "Email", "Total de pedidos", "Total gastado"]];

              for (const c of visibleCustomers) {
                const total = c.orders.reduce((s, o) => s + (o.total || 0), 0);
                const gasto = new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  minimumFractionDigits: 0,
                }).format(total);

                rows.push([
                  c.name ?? "",
                  c.email ?? "",
                  String(c.orders.length),
                  gasto,
                ]);
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
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-black shadow-none hover:bg-primary/90"
            onClick={() => {
              const rows = visibleCustomers.map((customer) => {
                const total = customer.orders.reduce((s, o) => s + (o.total || 0), 0);
                const gasto = new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  minimumFractionDigits: 0,
                }).format(total);

                return [customer.name ?? "", customer.email ?? "", String(customer.orders.length), gasto];
              });

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
                                .map((cell) => `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
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

        <div className="glass-panel overflow-x-auto rounded-2xl pb-2">
        <Table className="text-center w-auto mx-auto">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Total de pedidos</TableHead>
              <TableHead>Total gastado</TableHead>
              <TableHead>Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCustomers.map((c) => {
              const totalSpent = c.orders.reduce((s, o) => s + (o.total || 0), 0);
              return (
                <CustomerRow key={c.key} customer={c} totalSpent={totalSpent} />
              );
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

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {visibleCustomers.length} de {filteredCustomers.length} clientes mostrados
        </p>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Mostrar</div>
          <Input
            type="number"
            min={1}
            max={1000}
            value={pageSizeInput}
            placeholder="Ej: 10"
            onChange={(e) => setPageSizeInput(e.target.value)}
            className="h-8 w-28"
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
              >
                <Check className="h-4 w-4 mr-2" />Confirmar
              </Button>
            );
          })()}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setPage(0)} disabled={!hasPreviousPage}>
            Principio
          </Button>
          <div className="flex items-center gap-1 rounded-full border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm">
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                type="button"
                className={`rounded-full px-3 py-1 ${index === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-slate-100"}`}
                onClick={() => setPage(index)}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPage(totalPages - 1)} disabled={!hasNextPage}>
            Último
          </Button>
        </div>
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
          <button
            className="inline-flex items-center gap-2 rounded-md bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
