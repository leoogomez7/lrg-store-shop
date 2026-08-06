import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { catalogQueries, type Product } from "@/services/catalog.service";

type DeliveryUnit = "inmediata" | "horas" | "dias";

type ProductFormState = {
  id: string;
  name: string;
  brand: BrandSlug;
  category: string;
  price: number;
  stock: number;
  description: string;
  gastos: number;
  deliveryUnit: DeliveryUnit;
  deliveryAmount: number;
  discount: number;
};

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
  const [editableProducts, setEditableProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState<BrandSlug | "todas">("todas");
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);

  useEffect(() => {
    setEditableProducts(products);
  }, [products]);

  const defaultFormState: ProductFormState = {
    id: "",
    name: "",
    brand: "arcade",
    category: "",
    price: 0,
    stock: 0,
    description: "",
    gastos: 0,
    deliveryUnit: "inmediata",
    deliveryAmount: 1,
    discount: 0,
  };

  const openNewProductDialog = () => {
    setEditingProduct(null);
    setProductForm(defaultFormState);
    setDialogOpen(true);
  };

  const openEditProductDialog = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      stock: product.stock,
      description: product.description,
      gastos: 0,
      deliveryUnit: "inmediata",
      deliveryAmount: 1,
      discount: discounts[product.id] ?? 0,
    });
    setDialogOpen(true);
  };

  const handleSaveProduct = () => {
    if (!productForm) return;

    let savedProductId = productForm.id;

    setEditableProducts((current) => {
      const updated = current.map((item) =>
        item.id === productForm.id
          ? {
              ...item,
              name: productForm.name,
              brand: productForm.brand,
              category: productForm.category,
              price: productForm.price,
              stock: productForm.stock,
              description: productForm.description,
            }
          : item,
      );

      if (!editingProduct) {
        savedProductId = `new-${Date.now()}`;
        return [
          ...current,
          {
            id: savedProductId,
            slug: productForm.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, ""),
            brand: productForm.brand,
            name: productForm.name,
            category: productForm.category,
            price: productForm.price,
            stock: productForm.stock,
            rating: 0,
            reviews: 0,
            short: productForm.description,
            description: productForm.description,
            features: [],
            createdAt: new Date().toISOString().slice(0, 10),
          },
        ];
      }

      return updated;
    });

    if (savedProductId) {
      setDiscounts((current) => ({
        ...current,
        [savedProductId]: productForm.discount,
      }));
    }

    setDialogOpen(false);
  };

  const results = useMemo(
    () =>
      editableProducts.filter((product) => {
        if (brandFilter !== "todas" && product.brand !== brandFilter) return false;
        if (query && !product.name.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
      }),
    [editableProducts, query, brandFilter],
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Catálogo</p>
          <h1 className="mt-2 text-3xl font-semibold">Productos</h1>
        </div>
        <Button className="gap-2" onClick={openNewProductDialog}>
          <Plus className="size-4" /> Nuevo producto
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
          <SelectTrigger className="w-50">
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
              <TableHead>Aplicar descuento</TableHead>
              <TableHead>Precio con descuento</TableHead>
              <TableHead>Editar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((product) => {
              const discount = discounts[product.id] ?? 0;
              const discountedPrice = product.price * (1 - discount / 100);
              return (
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
                <TableCell className="text-muted-foreground uppercase">{product.category}</TableCell>
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
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={discount}
                    onChange={(event) =>
                      setDiscounts((current) => ({
                        ...current,
                        [product.id]: Number(event.target.value),
                      }))
                    }
                    placeholder="0%"
                    className="w-24"
                  />
                </TableCell>
                <TableCell>{formatPrice(Math.max(0, discountedPrice))}</TableCell>
                <TableCell>
                  <Button variant="secondary" size="sm" onClick={() => openEditProductDialog(product)}>
                    Editar
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
        {results.length === 0 && (
          <p className="p-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
        )}
      </div>
      <p className="mt-4 pb-16 text-xs text-muted-foreground">
        {results.length} de {editableProducts.length} productos
      </p>

      <ProductEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        productForm={productForm}
        setProductForm={setProductForm}
        onSave={handleSaveProduct}
      />
    </main>
  );
}

function ProductEditDialog({
  open,
  onOpenChange,
  productForm,
  setProductForm,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productForm: ProductFormState | null;
  setProductForm: (form: ProductFormState | null) => void;
  onSave: () => void;
}) {
  if (!productForm) return null;

  const ganancias = productForm.price - productForm.gastos;
  const isImmediate = productForm.deliveryUnit === "inmediata";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{productForm.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>
            Formulario de demostración: al conectar el backend, estos datos se guardarán en la base.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-name">Nombre</Label>
            <Input
              id="new-name"
              value={productForm.name}
              onChange={(event) =>
                setProductForm({ ...productForm, name: event.target.value })
              }
              placeholder="Nombre del producto"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-sector">Seleccionar sector</Label>
            <Select
              value={productForm.brand}
              onValueChange={(value) =>
                setProductForm({ ...productForm, brand: value as BrandSlug })
              }
            >
              <SelectTrigger id="new-sector" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {brandList.map((brand) => (
                  <SelectItem key={brand.slug} value={brand.slug}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-category">Categoría</Label>
            <Input
              id="new-category"
              value={productForm.category}
              onChange={(event) =>
                setProductForm({ ...productForm, category: event.target.value })
              }
              placeholder="Categoría"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-price">Precio</Label>
            <Input
              id="new-price"
              type="number"
              value={productForm.price}
              onChange={(event) =>
                setProductForm({ ...productForm, price: Number(event.target.value) })
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-gastos">Gastos</Label>
            <Input
              id="new-gastos"
              type="number"
              value={productForm.gastos}
              onChange={(event) =>
                setProductForm({ ...productForm, gastos: Number(event.target.value) })
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-discount">Descuento</Label>
            <Input
              id="new-discount"
              type="number"
              min={0}
              max={100}
              value={productForm.discount}
              onChange={(event) =>
                setProductForm({ ...productForm, discount: Number(event.target.value) })
              }
              placeholder="0%"
            />
          </div>
          <div className="space-y-2">
            <Label>Ganancias</Label>
            <div className="rounded-lg border border-input px-3 py-2 text-base text-foreground">
              {ganancias >= 0 ? formatPrice(ganancias) : `-${formatPrice(Math.abs(ganancias))}`}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-unit">Tiempo de entrega</Label>
            <Select
              value={productForm.deliveryUnit}
              onValueChange={(value) =>
                setProductForm({
                  ...productForm,
                  deliveryUnit: value as DeliveryUnit,
                })
              }
            >
              <SelectTrigger id="delivery-unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inmediata">Entrega inmediata</SelectItem>
                <SelectItem value="horas">Horas</SelectItem>
                <SelectItem value="dias">Días</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-amount">Cantidad</Label>
            <Input
              id="delivery-amount"
              type="number"
              min={1}
              value={productForm.deliveryAmount}
              onChange={(event) =>
                setProductForm({
                  ...productForm,
                  deliveryAmount: Number(event.target.value),
                })
              }
              placeholder="1"
              disabled={isImmediate}
            />
          </div>
          <div className="space-y-2">
            <Label>Entrega</Label>
            <div className="rounded-lg border border-input px-3 py-2 text-base text-foreground">
              {isImmediate
                ? "Entrega inmediata"
                : `${productForm.deliveryAmount} ${productForm.deliveryUnit}`}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-stock">Stock</Label>
            <Input
              id="new-stock"
              type="number"
              value={productForm.stock}
              onChange={(event) =>
                setProductForm({ ...productForm, stock: Number(event.target.value) })
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="new-desc">Descripción</Label>
            <Textarea
              id="new-desc"
              rows={3}
              value={productForm.description}
              onChange={(event) =>
                setProductForm({ ...productForm, description: event.target.value })
              }
              placeholder="Descripción del producto"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSave}>Guardar producto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
