import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Eye,
  Heart,
  MapPin,
  Package,
  Pencil,
  Paperclip,
  Plus,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { BrandHeader } from "@/components/layout/brand-header";
import { BrandFooter } from "@/components/layout/brand-footer";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { ProductCard } from "@/components/product/product-card";
import { webDesignConfig } from "@/config/brands/web-design.config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { saveKindeUserToTurso, getUserProfile, updateUserProfile, getUserAddresses, saveUserAddress, deleteUserAddress } from "@/lib/user";
import { catalogQueries, orderQueries } from "@/services/catalog.service";
import type { Order } from "@/data/orders";
import { hydrateFavorites } from "@/lib/favorites";

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

type Address = {
  id?: string;
  label: string;
  value: string;
};

function AccountPage() {
  return (
    <KindeAuthGate fallback={<AccountAuthRedirect />}>
      {(auth) => <AccountAuthGuard auth={auth} />}
    </KindeAuthGate>
  );
}

function AccountAuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/login", replace: true });
  }, [navigate]);

  return null;
}

function AccountAuthGuard({ auth }: { auth: ReturnType<typeof useKindeAuth> }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("lrg_auth_role") === "admin"
    ) {
      navigate({ to: "/admin", replace: true });
      return;
    }
    if (!auth.isLoading && !auth.isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  if (auth.isLoading || !auth.isAuthenticated) {
    return null;
  }

  return <AccountPageContent auth={auth} />;
}

function AccountPageContent({ auth }: { auth: ReturnType<typeof useKindeAuth> | null }) {
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const navigate = useNavigate();
  const {
    user,
    isAuthenticated,
    logout: kindeLogout,
  } = auth ?? {
    user: null,
    isAuthenticated: false,
    logout: async () => undefined,
  };
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPhone, setUserPhone] = useState<string>("");
  const [userDocument, setUserDocument] = useState<string>("");
  const [userCity, setUserCity] = useState<string>("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [attachmentsOrder, setAttachmentsOrder] = useState<Order | null>(null);
  const visibleOrders = userName ? orders.filter((order) => order.customer === userName) : [];
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const favoriteProducts = products.filter((product) => favoriteIds.includes(product.id));
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [addressValue, setAddressValue] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    const kindeName = user ? user.givenName || user.email || null : null;

    if (isAuthenticated && user) {
      setUserName(kindeName);
      saveKindeUserToTurso({
        id: user.id,
        email: user.email || null,
        givenName: user.givenName || null,
        familyName: user.familyName || null,
      });

      // Cargar perfil desde BD
      getUserProfile({ data: { userId: user.id } }).then((profile) => {
        if (profile) {
          setUserEmail(profile.email ?? user.email ?? "");
          setUserPhone(profile.phone ?? "");
          setUserDocument(profile.document ?? "");
          setUserCity(profile.city ?? "");
        } else {
          setUserEmail(user.email ?? "");
        }
      });
    } else {
      setUserName(null);
      setUserEmail("");
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    if (!user?.id) return;
    void hydrateFavorites(user.id).then(setFavoriteIds);

    // Cargar direcciones guardadas desde la BD
    void getUserAddresses({ data: { userId: user.id } }).then((addresses) => {
      setAddresses(
        addresses.map((addr) => ({
          ...(addr.id !== undefined ? { id: addr.id } : {}),
          label: addr.label,
          value: addr.value,
        })) as Address[]
      );
    });
  }, [user?.id]);

  return (
    <div className="theme-webdesign relative min-h-screen bg-background text-foreground">
      <BrandHeader
        brand={webDesignConfig}
        displayBrandName="LRG Store Shop"
        logoBrandSlug="store-shop"
      />
      <div className="aurora-bg" />
      <Tabs
        defaultValue="orders"
        className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-20 sm:px-6"
      >
        <div className="mt-6 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="gradient-brand grid size-14 place-items-center rounded-2xl">
              <User className="size-6 text-primary-foreground" />
            </span>
            <h1 className="text-3xl font-semibold">Hola{userName ? `, ${userName}` : ""}</h1>
          </div>
          <TabsList className="border border-border/70 bg-card/50 p-1 shadow-inner shadow-black/10 backdrop-blur-sm">
            <TabsTrigger value="orders" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <span aria-hidden="true">🛒</span>
              <span>Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <span aria-hidden="true">👤</span>
              <span>Perfil</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <span aria-hidden="true">📍</span>
              <span>Direcciones</span>
            </TabsTrigger>
            <TabsTrigger value="favorites" className="gap-2 px-4 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
              <span aria-hidden="true">❤️</span>
              <span>Favoritos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="orders" className="pt-6">
          <div className="glass-panel overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            <Table containerClassName="overflow-hidden">
              <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-background [&_th]:shadow-[0_1px_0_var(--border)]">
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Fecha de compra</TableHead>
                  <TableHead>Estado de envío</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Archivos adjuntos</TableHead>
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
                        <Badge
                          className="capitalize"
                          variant={order.deliveryStatus === "Enviado" ? "success" : "outline"}
                        >
                          {order.deliveryStatus ?? "Pendiente"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(order.total)}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!order.attachments?.length}
                          onClick={() => setAttachmentsOrder(order)}
                          className="gap-1.5 text-xs"
                        >
                          <Paperclip className="size-4" /> Mostrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="p-6 text-center text-sm text-muted-foreground"
                    >
                      {userName
                        ? "No tenés pedidos registrados aún."
                        : "Inicia sesión para ver tus pedidos."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Dialog
            open={attachmentsOrder !== null}
            onOpenChange={(open) => !open && setAttachmentsOrder(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Archivos adjuntos</DialogTitle>
                <DialogDescription>Documentos del pedido {attachmentsOrder?.id}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {attachmentsOrder?.attachments?.map((attachment) => (
                  <div
                    key={`${attachment.name}-${attachment.size}`}
                    className="flex items-center gap-3 rounded-xl border border-border/60 p-3"
                  >
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm">{attachment.name}</span>
                    <Button
                      asChild
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      <a href={attachment.dataUrl} target="_blank" rel="noreferrer">
                        <Eye className="size-4" /> Ver
                      </a>
                    </Button>
                    <Button
                      asChild
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                    >
                      <a href={attachment.dataUrl} download={attachment.name}>
                        <Download className="size-4" /> Descargar
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="profile" className="pt-6">
          {userName ? (
            <div className="glass-panel grid max-w-xl gap-4 rounded-2xl p-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-name">Nombre</Label>
                <Input id="account-name" value={userName} disabled className="opacity-50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email">Email</Label>
                <Input
                  id="account-email"
                  type="email"
                  value={userEmail}
                  disabled
                  className="opacity-50"
                />
                <p className="text-xs text-muted-foreground">Este email es el de acceso y no se puede modificar desde aquí.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-phone">Teléfono</Label>
                <Input
                  id="account-phone"
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  placeholder="Ingresá tu teléfono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-city">Ciudad</Label>
                <Input
                  id="account-city"
                  value={userCity}
                  onChange={(e) => setUserCity(e.target.value)}
                  placeholder="Ingresá tu ciudad"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-doc">Documento</Label>
                <Input
                  id="account-doc"
                  value={userDocument}
                  onChange={(e) => setUserDocument(e.target.value)}
                  placeholder="Ingresá tu documento"
                />
              </div>
              <Button
                className="sm:col-span-2 sm:w-fit"
                disabled={isSavingProfile}
                onClick={async () => {
                  setIsSavingProfile(true);
                  try {
                    const nextEmail = userEmail.trim();
                    const success = await updateUserProfile({
                      data: {
                        userId: user?.id || "",
                        email: nextEmail,
                        phone: userPhone,
                        document: userDocument,
                        city: userCity,
                      },
                    });

                    if (success) {
                      await saveKindeUserToTurso({
                        id: user?.id || "",
                        email: nextEmail || user?.email || null,
                        givenName: user?.givenName || null,
                        familyName: user?.familyName || null,
                      });
                      toast.success("Perfil actualizado correctamente");
                    } else {
                      toast.error("Error al actualizar el perfil");
                    }
                  } catch (error) {
                    console.error("Error al guardar:", error);
                    toast.error("Error al guardar los cambios");
                  } finally {
                    setIsSavingProfile(false);
                  }
                }}
              >
                {isSavingProfile ? "Guardando..." : "Guardar cambios"}
              </Button>
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
                  <p className="text-sm text-muted-foreground">
                    Agregá, editá o borrá tus direcciones de envío.
                  </p>
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
                      onClick={async () => {
                        if (!addressLabel.trim() || !addressValue.trim()) return;
                        // Guardar en BD
                        const result = await saveUserAddress({
                          data: {
                            userId: user?.id || "",
                            label: addressLabel.trim(),
                            value: addressValue.trim(),
                            city: userCity,
                          },
                        });
                        if (result) {
                          setAddresses((current) => [
                            ...current,
                            { label: addressLabel.trim(), value: addressValue.trim() },
                          ]);
                          setAddressLabel("");
                          setAddressValue("");
                          setShowAddForm(false);
                          toast.success("Dirección guardada correctamente");
                        } else {
                          toast.error("Error al guardar la dirección");
                        }
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
                onConfirm={async () => {
                  if (deleteIndex === null) return;
                  const addressToDelete = addresses[deleteIndex];
                  // Eliminar de la BD si tiene ID
                  if (addressToDelete?.id) {
                    await deleteUserAddress({ data: { addressId: addressToDelete.id } });
                  }
                  setAddresses((current) =>
                    current.filter((_, itemIndex) => itemIndex !== deleteIndex),
                  );
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
            favoriteProducts.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {favoriteProducts.map((product, index) => (
                  <ProductCard key={product.id} product={product} index={index} />
                ))}
              </div>
            ) : (
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
            )
          ) : (
            <div className="glass-panel rounded-2xl p-10 text-center text-base text-muted-foreground">
              Inicia sesión para ver tus favoritos.
            </div>
          )}
        </TabsContent>
      </Tabs>
      <BrandFooter brand={webDesignConfig} section="account" />
    </div>
  );
}
