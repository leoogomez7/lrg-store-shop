import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import { Download, Eye, EyeOff, FileText, Plus, Save, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { loadAdminSettings, saveAdminSetting } from "@/server/persistence";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { catalogQueries, orderQueries } from "@/services/catalog.service";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/admin/proveedores")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(catalogQueries.all()),
      context.queryClient.ensureQueryData(orderQueries.list()),
    ]);
  },
  head: () => ({ meta: [{ title: "LRG Store Shop - Proveedores" }] }),
  component: AdminSuppliers,
});

type SupplierRow = {
  key: string;
  name: string;
  phone: string;
  social: string;
  products: string[];
  sales: number;
};

type StandaloneSupplier = Pick<SupplierRow, "name" | "phone" | "social">;

const SUPPLIERS_STORAGE_KEY = "lrg:suppliers";

function AdminSuppliers() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const [query, setQuery] = React.useState("");
  const [expandedSupplierKey, setExpandedSupplierKey] = React.useState<string | null>(null);
  const [standaloneSuppliers, setStandaloneSuppliers] = React.useState<StandaloneSupplier[]>([]);
  const [newSupplierOpen, setNewSupplierOpen] = React.useState(false);
  const [newSupplier, setNewSupplier] = React.useState<StandaloneSupplier>({
    name: "",
    phone: "",
    social: "",
  });

  React.useEffect(() => {
    void loadAdminSettings({ data: {} }).then((settings) => {
      const stored = settings.find((setting) => setting.settingKey === SUPPLIERS_STORAGE_KEY);
      if (!stored) return;
      try {
        setStandaloneSuppliers(JSON.parse(stored.settingValue) as StandaloneSupplier[]);
      } catch {
        setStandaloneSuppliers([]);
      }
    });
  }, []);

  const rows = React.useMemo<SupplierRow[]>(() => {
    const grouped = new Map<string, SupplierRow>();
    for (const product of products) {
      const assignments = product.variants?.length
        ? product.variants.map((variant) => ({
            supplier: variant.supplier ?? product.supplier,
            productName: `${product.name} · ${variant.name}`,
            variantName: variant.name,
          }))
        : [{ supplier: product.supplier, productName: product.name, variantName: product.name }];
      for (const assignment of assignments) {
        const supplier = assignment.supplier;
        const name = supplier?.name ?? "";
        const phone = supplier?.phone ?? "";
        const social = supplier?.social ?? "";
        if (!name && !phone && !social) continue;
        const key = `${name}|${phone}|${social}`;
        const sales = orders.reduce(
          (sum, order) =>
            sum +
            order.items.reduce((itemSum, item) => {
              const itemName = item.name.toLowerCase();
              const itemVariantName = item.variantName?.toLowerCase();
              const matches =
                itemName === assignment.productName.toLowerCase() ||
                itemVariantName === assignment.variantName.toLowerCase() ||
                (!product.variants?.length && itemName === product.name.toLowerCase());
              return matches ? itemSum + item.price * item.quantity : itemSum;
            }, 0),
          0,
        );
        const current = grouped.get(key) ?? { key, name, phone, social, products: [], sales: 0 };
        if (!current.products.includes(assignment.productName))
          current.products.push(assignment.productName);
        current.sales += sales;
        grouped.set(key, current);
      }
    }
    for (const supplier of standaloneSuppliers) {
      const key = `${supplier.name}|${supplier.phone}|${supplier.social}`;
      if (!grouped.has(key)) grouped.set(key, { key, ...supplier, products: [], sales: 0 });
    }
    return Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders, products, standaloneSuppliers]);

  const addSupplier = () => {
    const supplier = {
      name: newSupplier.name.trim(),
      phone: newSupplier.phone.trim(),
      social: newSupplier.social.trim(),
    };
    if (!supplier.name || !supplier.phone || !supplier.social) return;
    const nextSuppliers = [...standaloneSuppliers, supplier];
    setStandaloneSuppliers(nextSuppliers);
    void saveAdminSetting({
      data: { settingKey: SUPPLIERS_STORAGE_KEY, settingValue: JSON.stringify(nextSuppliers) },
    });
    setNewSupplier({ name: "", phone: "", social: "" });
    setNewSupplierOpen(false);
  };

  const filteredRows = rows.filter((row) =>
    [row.name, row.phone, row.social, ...row.products].some((value) =>
      value.toLowerCase().includes(query.toLowerCase()),
    ),
  );

  const exportRows = filteredRows.map((row) => [
    row.name,
    row.phone,
    row.social,
    row.products.join(", "),
    row.sales,
  ]);
  const exportExcel = () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Nombre", "Celular", "Red social", "Productos", "Total venta"],
      ...exportRows,
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Proveedores");
    XLSX.writeFile(workbook, "proveedores.xlsx");
  };
  const exportPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(
      `<html><body><h2>Proveedores</h2><table border="1" cellpadding="6"><thead><tr><th>Nombre</th><th>Celular</th><th>Red social</th><th>Productos</th><th>Total venta</th></tr></thead><tbody>${exportRows.map((row) => `<tr>${row.map((cell) => `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`,
    );
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="order-1 shrink-0">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Listado</p>
          <h1 className="mt-2 text-3xl font-semibold">Proveedores</h1>
        </div>
        <div className="order-2 relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar proveedor"
            className="h-9 pl-9"
          />
        </div>
        <div className="order-3 contents">
          <Button
            onClick={() => {
              setNewSupplier({ name: "", phone: "", social: "" });
              setNewSupplierOpen(true);
            }}
            className="h-9 gap-2"
          >
            <Plus className="size-4" />
            Nuevo proveedor
          </Button>
          <Button
            onClick={exportExcel}
            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Download className="size-4" />
            Exportar Excel
          </Button>
          <Button onClick={exportPdf} className="gap-2 bg-red-600 text-white hover:bg-red-700">
            <FileText className="size-4" />
            Exportar PDF
          </Button>
        </div>
      </div>
      <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>Ingresá los datos del nuevo proveedor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Nombre</Label>
              <Input
                id="supplier-name"
                name="new-supplier-name"
                autoComplete="off"
                value={newSupplier.name}
                onChange={(event) =>
                  setNewSupplier((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Celular</Label>
              <Input
                id="supplier-phone"
                name="new-supplier-phone"
                autoComplete="off"
                value={newSupplier.phone}
                onChange={(event) =>
                  setNewSupplier((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-social">Red social</Label>
              <Input
                id="supplier-social"
                name="new-supplier-social"
                autoComplete="off"
                value={newSupplier.social}
                onChange={(event) =>
                  setNewSupplier((current) => ({ ...current, social: event.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={addSupplier}
              disabled={
                !newSupplier.name.trim() || !newSupplier.phone.trim() || !newSupplier.social.trim()
              }
            >
              <Save className="size-4" />
              Guardar proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="glass-panel overflow-hidden rounded-2xl">
        <Table className="text-center [&_td]:text-center [&_th]:text-center">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Red social</TableHead>
              <TableHead>Total venta</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const isExpanded = expandedSupplierKey === row.key;
              return (
                <React.Fragment key={row.key}>
                  <TableRow>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.phone}</TableCell>
                    <TableCell>{row.social}</TableCell>
                    <TableCell>{formatPrice(row.sales)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedSupplierKey(isExpanded ? null : row.key)}
                        className="gap-1.5 text-xs"
                      >
                        {isExpanded ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        {isExpanded ? "Ocultar" : "Detalles"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow>
                      <TableCell colSpan={5} className="bg-surface-2/70 p-4 text-left">
                        <p className="mb-2 font-medium">Productos</p>
                        <div className="flex flex-wrap gap-2">
                          {row.products.map((product) => (
                            <span
                              key={product}
                              className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
                            >
                              {product}
                            </span>
                          ))}
                          {row.products.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              Este proveedor todavía no tiene productos asignados.
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-16 text-muted-foreground">
                  No se encontraron proveedores.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
