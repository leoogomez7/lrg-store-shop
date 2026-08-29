import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Eye,
  Heart,
  House,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
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
import { cn } from "@/lib/utils";
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
  beforeLoad: () => ({
    redirect: "/cuenta/panel",
  }),
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

export type AccountTab = "inicio" | "orders" | "profile" | "addresses" | "favorites";

export function AccountPageSection({ initialTab = "inicio" }: { initialTab?: AccountTab }) {
  return (
    <KindeAuthGate fallback={<AccountAuthRedirect />}>
      {(auth) => <AccountAuthGuard auth={auth} initialTab={initialTab} />}
    </KindeAuthGate>
  );
}

function AccountPage() {
  return <AccountPageSection />;
}

function AccountAuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/login", replace: true });
  }, [navigate]);

  return null;
}

function AccountAuthGuard({
  auth,
  initialTab,
}: {
  auth: ReturnType<typeof useKindeAuth>;
  initialTab?: AccountTab;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("lrg_auth_role") === "admin"
    ) {
      navigate({ to: "/admin/panel", replace: true });
      return;
    }
    if (!auth.isLoading && !auth.isAuthenticated) {
      navigate({ to: "/login", replace: true });
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  if (auth.isLoading || !auth.isAuthenticated) {
    return null;
  }

  return <AccountPageContent auth={auth} initialTab={initialTab} />;
}

function AccountPageContent({
  auth,
  initialTab = "inicio",
}: {
  auth: ReturnType<typeof useKindeAuth> | null;
  initialTab?: AccountTab;
}) {
  const { data: orders } = useSuspenseQuery(orderQueries.list());
  const { data: products } = useSuspenseQuery(catalogQueries.all());
  const navigate = useNavigate();
  const location = useLocation();
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);

  const accountNavItems = [
    { key: "home", label: "Inicio", icon: House, route: "/" },
    { key: "admin-panel", label: "Panel administrativo", icon: LayoutDashboard, route: "/cuenta/panel" },
    { key: "orders", label: "Pedidos", icon: ShoppingCart, route: "/cuenta/pedidos" },
    { key: "profile", label: "Perfil", icon: User, route: "/cuenta/perfil" },
    { key: "addresses", label: "Direcciones", icon: MapPin, route: "/cuenta/direcciones" },
    { key: "favorites", label: "Favoritos", icon: Heart, route: "/cuenta/favoritos" },
  ] as const;

  type AccountNavKey = (typeof accountNavItems)[number]["key"];

  const resolveTabFromPath = (pathname: string): AccountTab => {
    if (pathname === "/cuenta/pedidos") return "orders";
    if (pathname === "/cuenta/perfil") return "profile";
    if (pathname === "/cuenta/direcciones") return "addresses";
    if (pathname === "/cuenta/favoritos") return "favorites";
    return "inicio";
  };

  useEffect(() => {
    const nextTab = resolveTabFromPath(location.pathname);
    setActiveTab(nextTab);
  }, [location.pathname]);

  const handleTabChange = (tab: AccountNavKey) => {
    if (tab === "home") {
      navigate({ to: "/", replace: false });
      return;
    }

    if (tab === "admin-panel") {
      navigate({ to: "/cuenta/panel", replace: false });
      return;
    }

    const routeMap: Record<AccountTab, string> = {
      inicio: "/cuenta/panel",
      orders: "/cuenta/pedidos",
      profile: "/cuenta/perfil",
      addresses: "/cuenta/direcciones",
      favorites: "/cuenta/favoritos",
    };

    const nextRoute = routeMap[tab];
    setActiveTab(tab);
    if (location.pathname !== nextRoute) {
      navigate({ to: nextRoute, replace: false });
    }
  };

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

  const getUserInitials = () => {
    if (!userName) return "C";
    const names = userName.trim().split(/\s+/).filter(Boolean);
    if (names.length === 1) return names[0].slice(0, 2).toUpperCase();
    return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
  };

  const renderAccountContent = () => {
    if (activeTab === "inicio") {
      return (
        <div className="space-y-6">
          <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
            <div className="mb-6 flex items-center gap-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <User className="size-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Mi cuenta</p>
                <h1 className="text-2xl font-semibold">Hola{userName ? `, ${userName}` : ""}</h1>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => handleTabChange("orders")}
                className="rounded-2xl border border-border/60 bg-background/50 p-4 text-left transition hover:border-border hover:bg-background"
              >
                <div className="mb-3 flex items-center justify-between">
                  <ShoppingCart className="size-5 text-primary" />
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pedidos</span>
                </div>
                <p className="text-2xl font-semibold">{visibleOrders.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">Total registrados</p>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("profile")}
                className="rounded-2xl border border-border/60 bg-background/50 p-4 text-left transition hover:border-border hover:bg-background"
              >
                <div className="mb-3 flex items-center justify-between">
                  <User className="size-5 text-primary" />
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Perfil</span>
                </div>
                <p className="text-sm text-muted-foreground">Datos personales</p>
                <p className="mt-2 text-base font-medium">Editar información</p>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("addresses")}
                className="rounded-2xl border border-border/60 bg-background/50 p-4 text-left transition hover:border-border hover:bg-background"
              >
                <div className="mb-3 flex items-center justify-between">
                  <MapPin className="size-5 text-primary" />
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Direcciones</span>
                </div>
                <p className="text-2xl font-semibold">{addresses.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">Guardadas</p>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("favorites")}
                className="rounded-2xl border border-border/60 bg-background/50 p-4 text-left transition hover:border-border hover:bg-background"
              >
                <div className="mb-3 flex items-center justify-between">
                  <Heart className="size-5 text-primary" />
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Favoritos</span>
                </div>
                <p className="text-2xl font-semibold">{favoriteProducts.length}</p>
                <p className="mt-1 text-sm text-muted-foreground">Productos guardados</p>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "orders") {
      return (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-surface/90 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
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
                  <TableCell colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                    {userName ? "No tenés pedidos registrados aún." : "Inicia sesión para ver tus pedidos."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
                    <Button asChild type="button" variant="ghost" size="sm" className="gap-1.5 text-xs">
                      <a href={attachment.dataUrl} target="_blank" rel="noreferrer">
                        <Eye className="size-4" /> Ver
                      </a>
                    </Button>
                    <Button asChild type="button" variant="ghost" size="sm" className="gap-1.5 text-xs">
                      <a href={attachment.dataUrl} download={attachment.name}>
                        <Download className="size-4" /> Descargar
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    if (activeTab === "profile") {
      return userName ? (
        <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Perfil</h2>
              <p className="text-sm text-muted-foreground">Actualizá tus datos personales.</p>
            </div>
          </div>
          <div className="grid max-w-3xl gap-5 sm:grid-cols-2">
            <div className="space-y-2.5">
              <Label htmlFor="account-name" className="text-sm font-medium text-foreground">Nombre</Label>
              <Input id="account-name" value={userName} disabled className="h-10 border-border/60 bg-muted/50 text-foreground opacity-60" />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="account-email" className="text-sm font-medium text-foreground">Email</Label>
              <Input id="account-email" type="email" value={userEmail} disabled className="h-10 border-border/60 bg-muted/50 text-foreground opacity-60" />
              <p className="text-xs text-muted-foreground leading-relaxed">Este email es el de acceso y no se puede modificar desde aquí.</p>
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="account-phone" className="text-sm font-medium text-foreground">Teléfono</Label>
              <Input id="account-phone" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} placeholder="Ingresá tu teléfono" className="h-10 border-border/60" />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="account-city" className="text-sm font-medium text-foreground">Ciudad</Label>
              <Input id="account-city" value={userCity} onChange={(e) => setUserCity(e.target.value)} placeholder="Ingresá tu ciudad" className="h-10 border-border/60" />
            </div>
            <div className="space-y-2.5 sm:col-span-2">
              <Label htmlFor="account-doc" className="text-sm font-medium text-foreground">Documento</Label>
              <Input id="account-doc" value={userDocument} onChange={(e) => setUserDocument(e.target.value)} placeholder="Ingresá tu documento" className="h-10 border-border/60" />
            </div>
            <Button className="sm:col-span-2 sm:w-fit h-10 px-6" disabled={isSavingProfile} onClick={async () => { setIsSavingProfile(true); try { const nextEmail = userEmail.trim(); const success = await updateUserProfile({ data: { userId: user?.id || "", email: nextEmail, phone: userPhone, document: userDocument, city: userCity } }); if (success) { await saveKindeUserToTurso({ id: user?.id || "", email: nextEmail || user?.email || null, givenName: user?.givenName || null, familyName: user?.familyName || null }); toast.success("Perfil actualizado correctamente"); } else { toast.error("Error al actualizar el perfil"); } } catch (error) { console.error("Error al guardar:", error); toast.error("Error al guardar los cambios"); } finally { setIsSavingProfile(false); } }}>
              {isSavingProfile ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-border/60 bg-surface/90 p-10 text-center text-base text-muted-foreground shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
          Inicia sesión para ver y editar tu perfil.
        </div>
      );
    }

    if (activeTab === "addresses") {
      return userName ? (
        <div className="rounded-3xl border border-border/60 bg-surface/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Direcciones</h2>
              <p className="text-sm text-muted-foreground">Agregá, editá o borrá tus direcciones de envío.</p>
            </div>
            <Button variant="secondary" size="sm" className="gap-2" onClick={() => { setShowAddForm((current) => !current); setEditingIndex(null); setAddressLabel(""); setAddressValue(""); }}>
              <Plus className="size-4" /> Nueva dirección
            </Button>
          </div>

          {showAddForm && (
            <div className="mb-6 rounded-2xl border border-border/60 bg-background/50 p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="new-address-label" className="text-sm font-medium">Etiqueta</Label>
                  <Input id="new-address-label" value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)} placeholder="Casa, Oficina, etc." className="h-10 border-border/60" />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="new-address-value" className="text-sm font-medium">Dirección</Label>
                  <Input id="new-address-value" value={addressValue} onChange={(event) => setAddressValue(event.target.value)} placeholder="Calle, número, ciudad, país" className="h-10 border-border/60" />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="sm" className="h-9 px-5" onClick={async () => { if (!addressLabel.trim() || !addressValue.trim()) return; const result = await saveUserAddress({ data: { userId: user?.id || "", label: addressLabel.trim(), value: addressValue.trim(), city: userCity } }); if (result) { setAddresses((current) => [...current, { label: addressLabel.trim(), value: addressValue.trim() }]); setAddressLabel(""); setAddressValue(""); setShowAddForm(false); toast.success("Dirección guardada correctamente"); } else { toast.error("Error al guardar la dirección"); } }}>
                  Guardar dirección
                </Button>
                <Button variant="outline" size="sm" className="h-9 px-5" onClick={() => { setShowAddForm(false); setAddressLabel(""); setAddressValue(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {addresses.map((address, index) => (
              <div key={`${address.label}-${index}`} className="rounded-2xl border border-border/60 bg-background/50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-full">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <MapPin className="size-4 text-primary" /> {address.label}
                    </h3>
                    {editingIndex === index ? (
                      <div className="mt-4 grid gap-4">
                        <div className="space-y-2.5">
                          <Label htmlFor={`edit-address-label-${index}`} className="text-sm font-medium">Etiqueta</Label>
                          <Input id={`edit-address-label-${index}`} value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)} className="h-10 border-border/60" />
                        </div>
                        <div className="space-y-2.5">
                          <Label htmlFor={`edit-address-value-${index}`} className="text-sm font-medium">Dirección</Label>
                          <Input id={`edit-address-value-${index}`} value={addressValue} onChange={(event) => setAddressValue(event.target.value)} className="h-10 border-border/60" />
                        </div>
                        <div className="flex flex-wrap gap-3 pt-1">
                          <Button size="sm" className="h-9 px-5" onClick={() => { if (!addressLabel.trim() || !addressValue.trim()) return; setAddresses((current) => current.map((item, itemIndex) => itemIndex === index ? { label: addressLabel.trim(), value: addressValue.trim() } : item)); setEditingIndex(null); setAddressLabel(""); setAddressValue(""); }}>
                            Guardar
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 px-5" onClick={() => { setEditingIndex(null); setAddressLabel(""); setAddressValue(""); }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-2 text-sm text-muted-foreground">{address.value}</p>
                        <div className="mt-4 flex gap-3">
                          <Button variant="outline" size="sm" className="gap-2 h-9 px-5" onClick={() => { setEditingIndex(index); setAddressLabel(address.label); setAddressValue(address.value); setShowAddForm(false); }}>
                            <Pencil className="size-4" /> Editar
                          </Button>
                          <Button variant="destructive" size="sm" className="gap-2 h-9 px-5" onClick={() => { setDeleteIndex(index); setDeleteOpen(true); }}>
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
          <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="¿Borrar dirección?" description="Esta acción eliminará la dirección seleccionada." confirmLabel="Borrar" cancelLabel="Cancelar" onConfirm={async () => { if (deleteIndex === null) return; const addressToDelete = addresses[deleteIndex]; if (addressToDelete?.id) { await deleteUserAddress({ data: { addressId: addressToDelete.id } }); } setAddresses((current) => current.filter((_, itemIndex) => itemIndex !== deleteIndex)); setDeleteIndex(null); }} />
        </div>
      ) : (
        <div className="rounded-3xl border border-border/60 bg-surface/90 p-10 text-center text-base text-muted-foreground shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
          Inicia sesión para ver y administrar tus direcciones.
        </div>
      );
    }

    if (activeTab === "favorites") {
      return userName ? (
        favoriteProducts.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-border/60 bg-surface/90 p-14 text-center shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
            <Heart className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Todavía no guardaste favoritos. Explorá los sectores y guardá lo que te guste.</p>
            <Button asChild size="sm">
              <Link to="/sectores">
                <Package className="mr-2 size-4" /> Explorar sectores
              </Link>
            </Button>
          </div>
        )
      ) : (
        <div className="rounded-3xl border border-border/60 bg-surface/90 p-10 text-center text-base text-muted-foreground shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
          Inicia sesión para ver tus favoritos.
        </div>
      );
    }

    return null;
  };

  return (
    <div className="theme-webdesign min-h-screen bg-background text-foreground">
      <div className="relative flex min-h-screen">
        <aside className={cn(
          "hidden shrink-0 border-r border-border/60 bg-surface/40 transition-[width] duration-200 lg:block",
          sidebarCollapsed ? "w-20" : "w-64",
        )}>
          <div
            className={cn(
              "sticky top-0 flex h-screen flex-col p-5",
              sidebarCollapsed && "items-center px-3",
            )}
          >
            <div
              className={cn(
                "mb-4 mt-2 flex w-full items-center",
                sidebarCollapsed ? "justify-center" : "justify-between gap-2",
              )}
            >
              <div className="inline-flex min-w-0 items-center gap-2 text-sm text-muted-foreground" title={userName ?? "Cliente"}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold uppercase text-primary">
                  {getUserInitials()}
                </span>
                {!sidebarCollapsed && (
                  <span className="truncate font-medium text-foreground">{userName || "Cliente"}</span>
                )}
              </div>
              {!sidebarCollapsed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed(true)}
                  title="Minimizar menú"
                >
                  <PanelLeftClose className="size-4" />
                </Button>
              )}
            </div>

            {sidebarCollapsed && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(false)}
                title="Expandir menú"
                className="mb-2"
              >
                <PanelLeftOpen className="size-4" />
              </Button>
            )}
            <nav className="mt-3 w-full space-y-1">
              {accountNavItems.map(({ key, label, icon: Icon }) => {
                const isActive = key === "home" || key === "admin-panel" ? false : activeTab === key;
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => handleTabChange(key)}
                    title={sidebarCollapsed ? label : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition-all duration-300 ease-out before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-white/10 before:via-white/5 before:to-transparent before:opacity-0 before:transition-all before:duration-300 before:content-[''] hover:-translate-y-0.5 hover:border-white/10 hover:bg-white/5 hover:shadow-[0_12px_24px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.08)] hover:text-foreground hover:before:opacity-100",
                      sidebarCollapsed && "justify-center px-2",
                      isActive
                        ? "border-white/10 bg-surface-2 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon className="relative z-10 size-4 shrink-0" />
                    {!sidebarCollapsed && <span className="relative z-10">{label}</span>}
                  </button>
                );
              })}
            </nav>

            <div className={cn("mt-auto flex gap-2", sidebarCollapsed && "justify-center")}>
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-red-600 hover:border-red-500 hover:bg-red-500/10 hover:text-red-600",
                    sidebarCollapsed && "size-9 px-0",
                  )}
                  title={sidebarCollapsed ? "Cerrar sesión" : undefined}
                  onClick={() => setLogoutOpen(true)}
                >
                  <LogOut className="size-4" />
                  {!sidebarCollapsed && "Cerrar sesión"}
                </Button>
              </>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6">
          <div className="min-h-[calc(100vh-8rem)] rounded-2xl border border-border/60 bg-[#0d1a2a]/90 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
            {renderAccountContent()}
          </div>
          <BrandFooter brand={webDesignConfig} section="account" />
        </main>
      </div>

      <ConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} title="¿Cerrar sesión?" description="¿Estás seguro de que deseas cerrar sesión?" confirmLabel="Sí, cerrar sesión" cancelLabel="No" onConfirm={async () => { await kindeLogout(); if (typeof window !== "undefined") { window.sessionStorage.removeItem("lrg_auth_role"); } navigate({ to: "/login", replace: true }); }} />
    </div>
  );
}
