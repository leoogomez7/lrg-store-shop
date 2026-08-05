import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductVisual } from "@/components/common/product-visual";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { formatPrice } from "@/lib/format";
import { catalogQueries } from "@/services/catalog.service";

export const Route = createFileRoute("/admin/productos")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueries.all()),
  head: () => ({
    meta: [
      { title: "Productos — Admin LRG Store Shop" },
      {
        name: "description",
        content: "Administrá el catálogo completo: precios, stock y categorías por sector.",
      },
      { property: "og:title", content: "Productos — Admin LRG Store Shop" },
      { property: "og:description", content: "Gestión de catálogo del ecosistema LRG." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminProducts,
});

function AdminProducts() {
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<BrandSlug | "todas">("todas");

  const results = useMemo(
    () =>
      products.filter((product) => {
        if (brandFilter !== "todas" && product.brand !== brandFilter) return false;
        if (query && !product.name.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [products, query, brandFilter],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
          <h1 className="mt-2 text-3xl font-semibold">Productos</h1>
        </div>
        <ProductDialog />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto"
            className="pl-9"
          />
        </div>
        <Select
          value={brandFilter}
          onValueChange={(value) => setBrandFilter(value as BrandSlug | "todas")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos los sectores</SelectItem>
            {brandList.map((brand) => (
              <SelectItem key={brand.slug} value={brand.slug}>
                {brand.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-panel mt-6 overflow-x-auto rounded-2xl pb-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Rating</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ProductVisual
                      seed={product.id}
                      label={product.name}
                      className="size-10 rounded-lg"
                    />
                    <span className="font-medium">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell>{brands[product.brand].shortName}</TableCell>
                <TableCell className="text-muted-foreground">{product.category}</TableCell>
                <TableCell>{formatPrice(product.price)}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      product.stock === 0
                        ? "destructive"
                        : product.stock <= 5
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {product.stock} u.
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{product.rating}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {results.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
        )}
      </div>
      <p className="mt-4 pb-16 text-xs text-muted-foreground">
        {results.length} de {products.length} productos
      </p>
    </main>
  );
}

function ProductDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Nuevo producto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>
            Formulario de demostración: al conectar el backend, estos datos se guardarán en la base.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-name">Nombre</Label>
            <Input id="new-name" placeholder="Nombre del producto" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-price">Precio</Label>
            <Input id="new-price" type="number" placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-stock">Stock</Label>
            <Input id="new-stock" type="number" placeholder="0" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-desc">Descripción</Label>
            <Textarea id="new-desc" rows={3} placeholder="Descripción del producto" />
          </div>
        </div>
        <DialogFooter>
          <Button>Guardar producto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
