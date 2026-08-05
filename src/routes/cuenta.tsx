import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Heart, MapPin, Package, User } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brands } from "@/config/brands";
import { formatDate, formatPrice } from "@/lib/format";
import { orderQueries } from "@/services/catalog.service";

export const Route = createFileRoute("/cuenta")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  head: () => ({
    meta: [
      { title: "Mi cuenta — LRG Store Shop" },
      {
        name: "description",
        content: "Gestioná tus pedidos, direcciones, favoritos y datos personales.",
      },
      { property: "og:title", content: "Mi cuenta — LRG Store Shop" },
      { property: "og:description", content: "Panel de cliente de LRG Store Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  pagado: "secondary",
  enviado: "default",
  entregado: "default",
  cancelado: "destructive",
};

function AccountPage() {
  const { data: orders } = useSuspenseQuery(orderQueries.list());

  return (
    <div className="theme-webdesign min-h-screen bg-background text-foreground">
      <div className="aurora-bg" />
      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <Link to="/">
            <BrandMark />
          </Link>
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/sectores">
              <ArrowLeft className="size-4" /> Sectores
            </Link>
          </Button>
        </header>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <span className="gradient-brand grid size-14 place-items-center rounded-2xl">
            <User className="size-6 text-primary-foreground" />
          </span>
          <div>
            <h1 className="text-3xl font-semibold">Hola, Cliente LRG</h1>
            <p className="text-sm text-muted-foreground">cliente@lrgstore.shop</p>
          </div>
        </div>

        <Tabs defaultValue="orders" className="mt-10 pb-20">
          <TabsList>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="addresses">Direcciones</TabsTrigger>
            <TabsTrigger value="favorites">Favoritos</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="pt-6">
            <div className="glass-panel overflow-hidden rounded-2xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell>{brands[order.brand].shortName}</TableCell>
                      <TableCell>{formatDate(order.date)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[order.status] ?? "secondary"}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="pt-6">
            <div className="glass-panel grid max-w-xl gap-4 rounded-2xl p-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nombre</Label>
                <Input id="account-name" defaultValue="Cliente LRG" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Email</Label>
                <Input id="account-email" defaultValue="cliente@lrgstore.shop" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-phone">Teléfono</Label>
                <Input id="account-phone" defaultValue="+54 11 4444 4444" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-doc">Documento</Label>
                <Input id="account-doc" defaultValue="35.123.456" />
              </div>
              <Button className="sm:col-span-2 sm:w-fit">Guardar cambios</Button>
            </div>
          </TabsContent>

          <TabsContent value="addresses" className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { label: "Casa", value: "Av. Siempre Viva 742, Buenos Aires" },
                { label: "Oficina", value: "Corrientes 1234, Piso 8, CABA" },
              ].map((address) => (
                <div key={address.label} className="glass-panel rounded-2xl p-6">
                  <h2 className="font-display flex items-center gap-2 font-semibold">
                    <MapPin className="size-4 text-primary" /> {address.label}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{address.value}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="pt-6">
            <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-14 text-center">
              <Heart className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Todavía no guardaste favoritos. Explorá los sectores y guardá lo que te guste.
              </p>
              <Button asChild size="sm">
                <Link to="/sectores">
                  <Package className="mr-2 size-4" /> Explorar sectores
                </Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
