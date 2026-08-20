import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Heart, MapPin, Package, Pencil, Plus, Trash2, User } from "lucide-react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { BrandHeader } from "@/components/layout/brand-header";
import { BrandFooter } from "@/components/layout/brand-footer";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { webDesignConfig } from "@/config/brands/web-design.config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { getStoredUserDisplayName } from "@/lib/auth";
import { saveKindeUserToTurso } from "@/lib/user";
import { orderQueries } from "@/services/catalog.service";

export const Route = createFileRoute("/cuenta")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  head: () => ({
    meta: [
      { title: "Mi cuenta" },
      {
        name: "description",
        content: "Gestioná tus pedidos, direcciones, favoritos y datos personales.",
      },
      { property: "og:title", content: "Mi cuenta" },
      { property: "og:description", content: "Panel de cliente de LRG Store Shop." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "icon", href: "/LRG Store Shop PNG.png", type: "image/png" }],
  }),
  component: AccountPage,
});

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "outline"> = {
  pendiente: "outline",
  pagado: "success",
  enviado: "warning",
  entregado: "default",
  cancelado: "destructive",
};

type Address = {
  label: string;
  value: string;
};

function AccountPage() {
  return (
    <KindeAuthGate fallback={<AccountPageContent auth={null} />}>
      {(auth) => <AccountPageContent auth={auth} />}
    </KindeAuthGate>
  );
}

function AccountPageContent({ auth }: { auth: ReturnType<typeof useKindeAuth> | null }) {
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const navigate = useNavigate();
  const { user, isAuthenticated, logout: kindeLogout } = auth ?? {
    user: null,
    isAuthenticated: false,
    logout: async () => undefined,
  };
  const [userName, setUserName] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const visibleOrders = userName ? orders.filter((order) => order.customer === userName) : [];
  const [addresses, setAddresses] = useState<Address[]>([
    { label: "Casa", value: "Av. Siempre Viva 742, Buenos Aires" },
    { label: "Oficina", value: "Corrientes 1234, Piso 8, CABA" },
  ]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [addressValue, setAddressValue] = useState("");

  useEffect(() => {
    const storedName = getStoredUserDisplayName();
    const kindeName = user ? user.givenName || user.email || null : null;

    if (isAuthenticated && user) {
      setUserName(kindeName);
      saveKindeUserToTurso({
        id: user.id,
        email: user.email,
        givenName: user.givenName,
        familyName: user.familyName,
      });
      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("userFullName", kindeName ?? "");
          window.sessionStorage.setItem("activePanel", "customer");
        }
      } catch {
        // ignore storage errors
      }
    } else {
      setUserName(storedName);
    }
  }, [user, isAuthenticated]);

  return (
    <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
      <BrandHeader brand={webDesignConfig} displayBrandName="LRG Store Shop" logoBrandSlug="store-shop" />
      <div className="aurora-bg" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 pt-20">
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <span className="gradient-brand grid size-14 place-items-center rounded-2xl">
              <User className="size-6 text-primary-foreground" />
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Hola{userName ? `, ${userName}` : ""}</h1>
            {userName ? (
              <p className="text-sm text-muted-foreground">{userName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Inicia sesión para ver tu cuenta.</p>
            )}
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
                  {visibleOrders.length > 0 ? (
                    visibleOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.id}</TableCell>
                        <TableCell>{brands[order.brand].shortName}</TableCell>
                        <TableCell>{formatDate(order.date)}</TableCell>
                        <TableCell>
                          <Badge className="capitalize" variant={statusVariant[order.status] ?? "secondary"}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                        {userName ? "No tenés pedidos registrados aún." : "Inicia sesión para ver tus pedidos."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="profile" className="pt-6">
            {userName ? (
              <div className="glass-panel grid max-w-xl gap-4 rounded-2xl p-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="account-name">Nombre</Label>
                  <Input id="account-name" defaultValue={userName} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-email">Email</Label>
                  <Input id="account-email" defaultValue={`${userName.toLowerCase().replace(/\s+/g, ".")}@lrgstore.shop`} />
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
            ) : (
              <div className="glass-panel rounded-2xl p-10 text-center text-base text-muted-foreground">
                Inicia sesión para ver y editar tu perfil.
              </div>
            )}
          </TabsContent>

          <TabsContent value="addresses" className="pt-6">
            {userName ? (
              <>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Direcciones</h2>
                    <p className="text-sm text-muted-foreground">Agregá, editá o borrá tus direcciones de envío.</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      setShowAddForm((current) => !current);
                      setEditingIndex(null);
                      setAddressLabel("");
                      setAddressValue("");
                    }}
                  >
                    <Plus className="size-4" /> Nueva dirección
                  </Button>
                </div>

                {showAddForm && (
                  <div className="glass-panel rounded-2xl p-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="new-address-label">Etiqueta</Label>
                        <Input
                          id="new-address-label"
                          value={addressLabel}
                          onChange={(event) => setAddressLabel(event.target.value)}
                          placeholder="Casa, Oficina, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-address-value">Dirección</Label>
                        <Input
                          id="new-address-value"
                          value={addressValue}
                          onChange={(event) => setAddressValue(event.target.value)}
                          placeholder="Calle, número, ciudad, país"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!addressLabel.trim() || !addressValue.trim()) return;
                          setAddresses((current) => [
                            ...current,
                            { label: addressLabel.trim(), value: addressValue.trim() },
                          ]);
                          setAddressLabel("");
                          setAddressValue("");
                          setShowAddForm(false);
                        }}
                      >
                        Guardar dirección
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddForm(false);
                          setAddressLabel("");
                          setAddressValue("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  {addresses.map((address, index) => (
                    <div key={`${address.label}-${index}`} className="glass-panel rounded-2xl p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h2 className="font-display flex items-center gap-2 font-semibold">
                            <MapPin className="size-4 text-primary" /> {address.label}
                          </h2>
                          {editingIndex === index ? (
                            <div className="mt-4 grid gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`edit-address-label-${index}`}>Etiqueta</Label>
                                <Input
                                  id={`edit-address-label-${index}`}
                                  value={addressLabel}
                                  onChange={(event) => setAddressLabel(event.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`edit-address-value-${index}`}>Dirección</Label>
                                <Input
                                  id={`edit-address-value-${index}`}
                                  value={addressValue}
                                  onChange={(event) => setAddressValue(event.target.value)}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (!addressLabel.trim() || !addressValue.trim()) return;
                                    setAddresses((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { label: addressLabel.trim(), value: addressValue.trim() }
                                          : item,
                                      ),
                                    );
                                    setEditingIndex(null);
                                    setAddressLabel("");
                                    setAddressValue("");
                                  }}
                                >
                                  Guardar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingIndex(null);
                                    setAddressLabel("");
                                    setAddressValue("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-sm text-muted-foreground">{address.value}</p>
                              <div className="mt-4 flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => {
                                    setEditingIndex(index);
                                    setAddressLabel(address.label);
                                    setAddressValue(address.value);
                                    setShowAddForm(false);
                                  }}
                                >
                                  <Pencil className="size-4" /> Editar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="gap-2"
                                  onClick={() => {
                                    setDeleteIndex(index);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="size-4" /> Borrar
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <ConfirmDialog
                  open={deleteOpen}
                  onOpenChange={setDeleteOpen}
                  title="¿Borrar dirección?"
                  description="Esta acción eliminará la dirección seleccionada."
                  confirmLabel="Borrar"
                  cancelLabel="Cancelar"
                  onConfirm={() => {
                    if (deleteIndex === null) return;
                    setAddresses((current) => current.filter((_, itemIndex) => itemIndex !== deleteIndex));
                    setDeleteIndex(null);
                  }}
                />
              </>
            ) : (
              <div className="glass-panel rounded-2xl p-10 text-center text-base text-muted-foreground">
                Inicia sesión para ver y administrar tus direcciones.
              </div>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="pt-6">
            {userName ? (
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
            ) : (
              <div className="glass-panel rounded-2xl p-10 text-center text-base text-muted-foreground">
                Inicia sesión para ver tus favoritos.
              </div>
            )}
          </TabsContent>
        </Tabs>
        <BrandFooter brand={webDesignConfig} />
    </div>
  );
}

