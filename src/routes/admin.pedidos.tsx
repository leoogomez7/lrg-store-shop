import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Lock, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { catalogQueries, orderQueries, type Product } from "@/services/catalog.service";
import type { BrandSlug } from "@/config/brands";
import type { Order, OrderStatus } from "@/data/orders";

const statuses: (OrderStatus | "todos")[] = [
  "todos",
  "pendiente",
  "pagado",
  "enviado",
  "entregado",
  "cancelado",
];

const brandsFilter: (BrandSlug | "todos")[] = ["todos", "arcade", "scents", "web-design"];

const paymentMethods = ["Transferencia", "Efectivo", "Tarjeta", "Mercado Pago"];

type OrderSort =
  | "customer_asc"
  | "customer_desc"
  | "date_desc"
  | "date_asc"
  | "total_desc"
  | "total_asc";

type EditableOrderItem = {
  name: string;
  quantity: number;
  price: number;
  stock?: number;
  confirmed?: boolean;
};

type EditableOrder = Omit<Order, "items"> & {
  items: EditableOrderItem[];
};

function computeOrderTotals(items: EditableOrderItem[], expenseRatio = 0.65) {
  const total = items.reduce(
    (sum, item) => sum + (item.confirmed ? item.price * item.quantity : 0),
    0,
  );
  const expenses = Math.round(total * expenseRatio);
  return {
    total,
    expenses,
    profit: total - expenses,
  };
}

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
  const { data: allProducts } = useSuspenseQuery(catalogQueries.all());
  const [editableOrders, setEditableOrders] = useState<typeof orders>([]);
  const [status, setStatus] = useState<OrderStatus | "todos">("todos");
  const [brand, setBrand] = useState<BrandSlug | "todos">("todos");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<OrderSort>("customer_asc");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<EditableOrder | null>(null);
  const [paymentInstruction, setPaymentInstruction] = useState<string>("");
  const [productSearchQuery, setProductSearchQuery] = useState<Record<number, string>>({});
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);

  useEffect(() => {
    setEditableOrders(orders);
  }, [orders]);

  const results = useMemo(() => {
    const filtered = editableOrders.filter((order) => {
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
  }, [editableOrders, status, brand, query, sortOrder]);

  const openEditOrderDialog = (order: Order) => {
    const expenseRatio = order.total ? order.expenses / order.total : 0.65;
    const cloned: EditableOrder = {
      ...order,
      items: order.items.map((item) => {
        const productMatch = allProducts.find((product) => product.name === item.name);
        return {
          ...item,
          stock: productMatch?.stock,
          confirmed: true,
        };
      }),
    };
    const totals = computeOrderTotals(cloned.items, expenseRatio);
    cloned.total = totals.total;
    cloned.expenses = totals.expenses;
    cloned.profit = totals.profit;
    setOrderForm(cloned);
    setPaymentInstruction("");
    setDialogOpen(true);
  };

  const clampQuantity = (item: EditableOrderItem, quantity: number) => {
    if (item.stock === undefined) return Math.max(1, quantity);
    return Math.min(Math.max(1, quantity), item.stock);
  };

  const getPaymentInstruction = (from: string, to: string) => {
    if (from === to) return "";
    if (to === "Transferencia") return "Enviar al cliente CBU o alias.";
    if (to === "Efectivo") return "Enviar al cliente el código de acreditación.";
    if (to === "Tarjeta" || to === "Mercado Pago") return "Enviar al cliente un link de pago para abonar el pago.";
    return "";
  };

  const updateOrderItems = (items: EditableOrderItem[]) => {
    if (!orderForm) return;
    const ratio = orderForm.total ? orderForm.expenses / orderForm.total : 0.65;
    const totals = computeOrderTotals(items, ratio);
    setOrderForm({
      ...orderForm,
      items,
      total: totals.total,
      expenses: totals.expenses,
      profit: totals.profit,
    });
  };

  const addOrderItem = () => {
    if (!orderForm) return;
    setOrderForm({
      ...orderForm,
      items: [
        ...orderForm.items,
        { name: "", quantity: 1, price: 0, confirmed: false },
      ],
    });
  };

  const removeOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    nextItems.splice(index, 1);
    updateOrderItems(nextItems);
  };

  const confirmOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    const item = nextItems[index];
    if (!item.name || item.quantity < 1 || (item.stock !== undefined && item.quantity > item.stock)) return;
    nextItems[index] = { ...item, confirmed: true };
    updateOrderItems(nextItems);
  };

  const unconfirmOrderItem = (index: number) => {
    if (!orderForm) return;
    const nextItems = [...orderForm.items];
    const item = nextItems[index];
    nextItems[index] = { ...item, confirmed: false };
    updateOrderItems(nextItems);
  };

  const isOrderFormValid = orderForm
    ? orderForm.items.every(
        (item) =>
          item.name &&
          item.confirmed &&
          item.quantity >= 1 &&
          (item.stock === undefined || item.quantity <= item.stock),
      )
    : true;

  const handleSaveOrder = () => {
    if (!orderForm || !isOrderFormValid) return;
    setEditableOrders((current) =>
      current.map((order) => (order.id === orderForm.id ? orderForm : order)),
    );
    setDialogOpen(false);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Ventas</p>
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
              <TableHead className="text-right">Gastos</TableHead>
              <TableHead className="text-right">Ganancias</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
              <TableHead className="text-right">Detalles</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const nameParts = order.customer.split(" ");
              const displayCustomer =
                nameParts.length > 1
                  ? `${nameParts[0]} ${nameParts[nameParts.length - 1]}`
                  : order.customer;

              return (
                <Fragment key={order.id}>
                  <TableRow>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>
                      <span className="block">{displayCustomer}</span>
                    </TableCell>
                    <TableCell>{brands[order.brand].shortName}</TableCell>
                    <TableCell>{formatDate(order.date)}</TableCell>
                    <TableCell>
                      <Badge className="capitalize" variant={statusVariant[order.status]}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPrice(order.expenses)}</TableCell>
                    <TableCell className="text-right">{formatPrice(order.profit)}</TableCell>
                    <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => openEditOrderDialog(order)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80"
                        aria-label="Editar pedido"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </TableCell>
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
                      <TableCell colSpan={10} className="bg-surface-2/70 p-5">
                        <div className="space-y-3 text-sm">
                          <p className="font-medium">Detalle del pedido</p>
                          <div className="grid gap-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
                            <span className="text-muted-foreground">Correo</span>
                            <span>{order.email}</span>
                            <span className="text-muted-foreground">Celular</span>
                            <span>{order.phone}</span>
                            <span className="text-muted-foreground">Método de pago</span>
                            <span>{order.paymentMethod}</span>
                            <span className="text-muted-foreground">Observaciones</span>
                            <span>{order.extraInfo}</span>
                          </div>
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
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar pedido</DialogTitle>
          </DialogHeader>
          {orderForm ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Pedido</Label>
                  <Input value={orderForm.id} disabled />
                </div>
                <div>
                  <Label>Fecha</Label>
                  <Input value={formatDate(orderForm.date)} disabled />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Cliente</Label>
                  <Input
                    value={orderForm.customer}
                    onChange={(event) => setOrderForm({ ...orderForm, customer: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Correo</Label>
                  <Input
                    value={orderForm.email}
                    onChange={(event) => setOrderForm({ ...orderForm, email: event.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Celular</Label>
                  <Input
                    value={orderForm.phone}
                    onChange={(event) => setOrderForm({ ...orderForm, phone: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Método de pago</Label>
                  <Select
                    value={orderForm.paymentMethod}
                    onValueChange={(value) => {
                      if (!orderForm) return;
                      const nextInstruction = getPaymentInstruction(orderForm.paymentMethod, value);
                      setOrderForm({
                        ...orderForm,
                        paymentMethod: value,
                        status: "pendiente",
                      });
                      setPaymentInstruction(nextInstruction);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar método" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>
                          {method}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Observaciones</Label>
                <Textarea
                  value={orderForm.extraInfo}
                  onChange={(event) => setOrderForm({ ...orderForm, extraInfo: event.target.value })}
                />
              </div>

              {paymentInstruction ? (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-foreground">
                  <p className="font-semibold">Instrucción de pago</p>
                  <p>{paymentInstruction}</p>
                </div>
              ) : null}

              <div className="space-y-3">
                <p className="font-semibold">Productos</p>
                <div className="space-y-3">
                  {orderForm.items.map((item, itemIndex) => {
                    const searchQuery = productSearchQuery[itemIndex] ?? item.name;
                    const filteredProducts = allProducts
                      .filter((product) =>
                        product.name.toLowerCase().includes(searchQuery.toLowerCase()),
                      )
                      .slice(0, 8);

                    return (
                      <div key={`${item.name}-${itemIndex}`} className="relative grid gap-2 sm:grid-cols-[1.7fr_1fr_1fr_auto]">
                        <div className="relative">
                          <Label>Nombre</Label>
                          <Input
                            value={searchQuery}
                            onFocus={() => setActiveSuggestionIndex(itemIndex)}
                            onChange={(event) => {
                              setProductSearchQuery((current) => ({
                                ...current,
                                [itemIndex]: event.target.value,
                              }));
                              setActiveSuggestionIndex(itemIndex);
                            }}
                            onBlur={() => {
                              window.setTimeout(() => {
                                setActiveSuggestionIndex((current) => (current === itemIndex ? null : current));
                              }, 120);
                            }}
                          />
                          {activeSuggestionIndex === itemIndex && filteredProducts.length > 0 && (
                            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                              <div className="space-y-1 p-2">
                                {filteredProducts.map((product) => {
                                  const isOutOfStock = product.stock <= 0;
                                  return (
                                    <button
                                      key={product.id}
                                      type="button"
                                      disabled={isOutOfStock}
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={() => {
                                        const nextItems = [...orderForm.items];
                                        nextItems[itemIndex] = {
                                          ...item,
                                          name: product.name,
                                          price: product.price,
                                          stock: product.stock,
                                          quantity: clampQuantity({ ...item, stock: product.stock }, item.quantity),
                                          confirmed: false,
                                        };
                                        setProductSearchQuery((current) => ({
                                          ...current,
                                          [itemIndex]: product.name,
                                        }));
                                        updateOrderItems(nextItems);
                                        setActiveSuggestionIndex(null);
                                      }}
                                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                                        isOutOfStock
                                          ? "cursor-not-allowed bg-surface text-muted-foreground"
                                          : "cursor-pointer hover:bg-surface-2"
                                      }`}
                                    >
                                      <div>
                                        <p className="font-medium">{product.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatPrice(product.price)} · {product.stock} disponibles
                                        </p>
                                      </div>
                                      {isOutOfStock ? <Lock className="size-4 text-muted-foreground" /> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        <div>
                          <Label>Cantidad</Label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => {
                              const nextItems = [...orderForm.items];
                              nextItems[itemIndex] = {
                                ...item,
                                quantity: clampQuantity(item, Number(event.target.value) || 1),
                              };
                              updateOrderItems(nextItems);
                            }}
                          />
                        </div>
                        <div>
                          <Label>Precio</Label>
                          <Input type="number" min={0} step={0.01} value={item.price} disabled />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button
                            type="button"
                            variant={item.confirmed ? "secondary" : "outline"}
                            onClick={() => confirmOrderItem(itemIndex)}
                            disabled={!item.name || item.quantity < 1 || (item.stock !== undefined && item.quantity > item.stock)}
                            className="h-10 px-3"
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => unconfirmOrderItem(itemIndex)}
                            className="h-10 p-2"
                          >
                            <X className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeOrderItem(itemIndex)}
                            className="h-10 p-2"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="secondary" onClick={addOrderItem} className="inline-flex items-center gap-2">
                  <Plus className="size-4" />
                  Agregar producto
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Gastos</Label>
                  <Input value={formatPrice(orderForm.expenses)} disabled />
                </div>
                <div>
                  <Label>Ganancias</Label>
                  <Input value={formatPrice(orderForm.profit)} disabled />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input value={formatPrice(orderForm.total)} disabled />
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveOrder} disabled={!isOrderFormValid}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
