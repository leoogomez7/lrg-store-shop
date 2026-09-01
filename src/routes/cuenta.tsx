import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  Download,
  Eye,
  FileText,
  Filter,
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
  Save,
  Search,
  Sheet,
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
import {
  saveKindeUserToTurso,
  getUserProfile,
  updateUserProfile,
  getUserAddresses,
  saveUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setPrimaryUserAddress,
} from "@/lib/user";
import { catalogQueries, orderQueries } from "@/services/catalog.service";
import type { Order } from "@/data/orders";
import { hydrateFavorites } from "@/lib/favorites";

export const Route = createFileRoute("/cuenta")({
  loader: ({ context }) => context.queryClient.ensureQueryData(orderQueries.list()),
  beforeLoad: ({ location }) => {
    if (location.pathname === "/cuenta") {
      return { redirect: "/cuenta/panel" };
    }
    return undefined;
  },
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
  isPrimary?: boolean;
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
  const [userGivenName, setUserGivenName] = useState<string>("");
  const [userFamilyName, setUserFamilyName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userPhone, setUserPhone] = useState<string>("");
  const [userDocument, setUserDocument] = useState<string>("");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [attachmentsOrder, setAttachmentsOrder] = useState<Order | null>(null);
  const visibleOrders = userName ? orders.filter((order) => order.customer === userName) : [];
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const favoriteProducts = products.filter((product) => favoriteIds.includes(product.id));
  const [addresses, setAddresses] = useState<Address[]>([]);
  const primaryAddress = addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [addressValue, setAddressValue] = useState("");
  const [mapPreviewUrl, setMapPreviewUrl] = useState<string | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab);
  const [addressSuggestions, setAddressSuggestions] = useState<Array<{ label: string; value: string; display?: { street: string; city: string }; lat?: string; lon?: string }>>([]);
  const [ordersPage, setOrdersPage] = useState(0);
  const [ordersPageSize, setOrdersPageSize] = useState<number>(10);
  const [ordersPageSizeInput, setOrdersPageSizeInput] = useState<string>("10");

  const accountNavItems = [
    { key: "home", label: "Inicio", icon: House, route: "/" },
    { key: "admin-panel", label: "Panel administrativo", icon: LayoutDashboard, route: "/cuenta/panel" },
    { key: "orders", label: "Compras", icon: ShoppingCart, route: "/cuenta/compras" },
    { key: "profile", label: "Perfil", icon: User, route: "/cuenta/perfil" },
    { key: "addresses", label: "Direcciones", icon: MapPin, route: "/cuenta/direcciones" },
    { key: "favorites", label: "Favoritos", icon: Heart, route: "/cuenta/favoritos" },
  ] as const;

  type AccountNavKey = (typeof accountNavItems)[number]["key"];

  const resolveTabFromPath = (pathname: string): AccountTab => {
    if (pathname === "/cuenta/compras" || pathname === "/cuenta/pedidos") return "orders";
    if (pathname === "/cuenta/perfil") return "profile";
    if (pathname === "/cuenta/direcciones") return "addresses";
    if (pathname === "/cuenta/favoritos") return "favorites";
    return "inicio";
  };

  const totalOrdersPages =
    ordersPageSize && ordersPageSize > 0 ? Math.max(1, Math.ceil(visibleOrders.length / ordersPageSize)) : 1;
  const paginatedOrders = useMemo(() => {
    if (!ordersPageSize || ordersPageSize <= 0) return [] as typeof visibleOrders;
    return visibleOrders.slice(
      ordersPage * ordersPageSize,
      ordersPage * ordersPageSize + ordersPageSize,
    );
  }, [visibleOrders, ordersPage, ordersPageSize]);
  const hasNextPage = ordersPage + 1 < totalOrdersPages;
  const hasPreviousPage = ordersPage > 0;
  const canEditOrdersPageSize = totalOrdersPages > 1;

  const exportOrdersExcel = () => {
    const rows: (string | number)[][] = [
      ["Pedido", "Tienda", "Fecha de compra", "Estado de envío", "Total"],
      ...visibleOrders.map((order) => [
        order.id,
        brands[order.brand].shortName,
        order.date,
        order.deliveryStatus ?? "Pendiente",
        order.total,
      ]),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Compras");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `compras_${date}.xlsx`);
  };

  const exportOrdersPdf = () => {
    const rows = visibleOrders.map((order) => [
      order.id,
      brands[order.brand].shortName,
      order.date,
      order.deliveryStatus ?? "Pendiente",
      order.total,
    ]);

    const tableHtml = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            table { border-collapse: collapse; width: 100%; font-size: 12px; }
            th, td { border: 1px solid #d4d4d4; padding: 8px; text-align: left; }
            th { background: #f3f3f3; }
          </style>
        </head>
        <body>
          <h2>Compras</h2>
          <table>
            <thead>
              <tr>
                <th>Pedido</th>
                <th>Tienda</th>
                <th>Fecha de compra</th>
                <th>Estado de envío</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) =>
                    `<tr>${row
                      .map(
                        (cell) =>
                          `<td>${String(cell).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`,
                      )
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
    printWindow.document.title = `compras_${date}`;
    printWindow.document.write(tableHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  useEffect(() => {
    setOrdersPage((currentPage) => Math.min(currentPage, Math.max(0, totalOrdersPages - 1)));
  }, [totalOrdersPages]);

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
      orders: "/cuenta/compras",
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
    if (isAuthenticated && user) {
      const nextGivenName = user.givenName ?? "";
      const nextFamilyName = user.familyName ?? "";
      const nextFullName = [nextGivenName, nextFamilyName].filter(Boolean).join(" ").trim();
      setUserGivenName(nextGivenName);
      setUserFamilyName(nextFamilyName);
      setUserName(nextFullName || user.email || null);

      saveKindeUserToTurso({
        id: user.id,
        email: user.email || null,
        givenName: nextGivenName || null,
        familyName: nextFamilyName || null,
      });

      // Cargar perfil desde BD
      getUserProfile({ data: { userId: user.id } }).then((profile) => {
        if (profile) {
          const profileGivenName = profile.givenName ?? "";
          const profileFamilyName = profile.familyName ?? "";
          const profileFullName = [profileGivenName, profileFamilyName].filter(Boolean).join(" ").trim();

          setUserGivenName(profileGivenName || nextGivenName);
          setUserFamilyName(profileFamilyName || nextFamilyName);
          setUserName(profileFullName || nextFullName || user.email || null);
          setUserEmail(profile.email ?? user.email ?? "");
          setUserPhone(profile.phone ?? "");
          setUserDocument(profile.document ?? "");
        } else {
          setUserEmail(user.email ?? "");
        }
      });
    } else {
      setUserName(null);
      setUserGivenName("");
      setUserFamilyName("");
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
          isPrimary: Boolean(addr.isPrimary),
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

  const getAddressBadge = (label: string) => {
    const cleaned = label.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, "").slice(0, 3).toUpperCase();
    return cleaned || "ADR";
  };

  useEffect(() => {
    const query = addressValue.trim();
    if (!query) {
      setMapPreviewUrl(null);
      setAddressSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setIsMapLoading(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&q=${encodeURIComponent(query)}`,
          { headers: { "Accept-Language": "es" } },
        );
        const data = (await response.json()) as Array<{
          lat?: string;
          lon?: string;
          display_name?: string;
          address?: Record<string, string>;
        }>;

        if (data.length > 0) {
          const normalizeAddressText = (value: string) =>
            value
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9 ]/g, " ")
              .replace(/\s+/g, " ")
              .trim();

          const formatAddress = (item: { display_name?: string; address?: Record<string, string> }) => {
            const address = item.address ?? {};
            const road = address.road || address.pedestrian || address.path || address.street || "";
            const houseNumber = address.house_number || address.house || "";
            const city =
              address.city ||
              address.town ||
              address.village ||
              address.municipality ||
              address.county ||
              address.state ||
              "";
            const district = address.suburb || address.neighbourhood || address.city_district || "";

            const displayName = item.display_name || "";
            const extractedFromDisplay = displayName.split(",")[0]?.trim() || "";
            const fallbackStreetMatch = extractedFromDisplay.match(/^(.*?\d+\s*[A-Za-z]?)$/);
            const fallbackStreet = fallbackStreetMatch?.[1]?.trim() || extractedFromDisplay;
            const fallbackNumber = extractedFromDisplay.match(/(\d+\s*[A-Za-z0-9-]*)$/)?.[1]?.trim() || "";

            const resolvedRoad = road || fallbackStreet.replace(new RegExp(`\\s*${fallbackNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), "").trim();
            const resolvedHouseNumber = houseNumber || fallbackNumber || "";

            const street = [resolvedRoad, resolvedHouseNumber].filter(Boolean).join(" ").trim();
            const area = [district, city].filter(Boolean).join(", ").trim();
            const value = [street, area].filter(Boolean).join(", ").trim();

            return {
              street: street || displayName.split(",")[0]?.trim() || "",
              city: area || displayName.split(",").slice(1).join(", ").trim() || "",
              value: value || displayName || "Dirección",
            };
          };

          const seen = new Set<string>();
          const suggestions = data.reduce<Array<{ label: string; value: string; display?: { street: string; city: string }; lat?: string; lon?: string }>>((acc, item) => {
            const formatted = formatAddress(item);
            const candidate = formatted.value;
            const key = normalizeAddressText(candidate);

            if (!candidate || !key || seen.has(key)) {
              return acc;
            }

            seen.add(key);
            acc.push({
              label: candidate,
              value: candidate,
              display: { street: formatted.street, city: formatted.city },
              lat: item.lat,
              lon: item.lon,
            });
            return acc;
          }, []);

          setAddressSuggestions(suggestions.slice(0, 3));

          const location = data[0];
          if (location?.lat && location?.lon) {
            const lat = Number(location.lat);
            const lon = Number(location.lon);
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              setMapPreviewUrl(`https://maps.google.com/maps?q=${lat},${lon}&z=15&output=embed&hl=es`);
            }
          }
        } else {
          setMapPreviewUrl(null);
          setAddressSuggestions([]);
        }
      } catch (error) {
        console.error("Error generando vista de mapa:", error);
        setMapPreviewUrl(null);
        setAddressSuggestions([]);
      } finally {
        setIsMapLoading(false);
      }
    }, 600);

    return () => window.clearTimeout(timer);
  }, [addressValue]);

  const renderAccountContent = () => {
    if (activeTab === "inicio") {
      return (
        <div className="space-y-6">
          <div className="space-y-6">
            <div className="mb-6">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Inicio</p>
              <h1 className="mt-2 text-3xl font-semibold">Mi cuenta</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Administrá tus compras, favoritos y tus datos personales.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <button
                type="button"
                onClick={() => handleTabChange("orders")}
                className="glass-panel flex min-h-[168px] flex-col justify-between rounded-2xl p-4 text-left transition hover:border-border/60"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <ShoppingCart className="size-4" />
                  </span>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pedidos</span>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{visibleOrders.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Compras</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("profile")}
                className="glass-panel flex min-h-[168px] flex-col justify-between rounded-2xl p-4 text-left transition hover:border-border/60"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <User className="size-4" />
                  </span>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Perfil</span>
                </div>
                <div>
                  <p className="text-base font-medium">Editar información</p>
                  <p className="mt-1 text-sm text-muted-foreground">Datos personales</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("addresses")}
                className="glass-panel flex min-h-[168px] flex-col justify-between rounded-2xl p-4 text-left transition hover:border-border/60"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="size-4" />
                  </span>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Direcciones</span>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{addresses.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Guardadas</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("favorites")}
                className="glass-panel flex min-h-[168px] flex-col justify-between rounded-2xl p-4 text-left transition hover:border-border/60"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Heart className="size-4" />
                  </span>
                  <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Favoritos</span>
                </div>
                <div>
                  <p className="text-2xl font-semibold">{favoriteProducts.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Productos guardados</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "orders") {
      return (
        <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="order-1 basis-full shrink-0">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Compras</p>
              <h1 className="mt-2 text-3xl font-semibold">Pedidos</h1>
            </div>

            <div className="order-2 relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido"
                className="h-9 pl-9"
                readOnly
                aria-label="Buscar pedido"
              />
            </div>

            <div className="order-3 flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="h-9 shrink-0 gap-1.5 px-2.5">
                <ArrowUpDown className="size-4 text-white" />
                Ordenar por
              </Button>

              <Button type="button" variant="outline" className="h-9 shrink-0 gap-1.5 px-2.5">
                <Filter className="size-4 text-white" />
                Filtros
              </Button>

              <Button
                type="button"
                onClick={exportOrdersExcel}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-emerald-700"
              >
                <Sheet className="size-4" />
                Exportar Excel
              </Button>

              <Button
                type="button"
                onClick={exportOrdersPdf}
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-none hover:bg-red-700"
              >
                <FileText className="size-4" />
                Exportar PDF
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-muted/20 backdrop-blur-sm">
            <Table containerClassName="overflow-hidden">
              <TableHeader className="[&_th]:bg-surface-2 [&_th]:text-sm [&_th]:font-medium [&_th]:text-foreground/90 [&_th]:shadow-[0_1px_0_var(--border)]">
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
                  paginatedOrders.map((order) => (
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
                      {userName ? "No se encontraron compras." : "Inicia sesión para ver tus pedidos."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {paginatedOrders.length} de {visibleOrders.length} compras mostradas
            </p>
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">Mostrar</div>
              <Input
                type="number"
                min={1}
                max={1000}
                value={ordersPageSizeInput}
                onChange={(e) => setOrdersPageSizeInput(e.target.value)}
                disabled={!canEditOrdersPageSize}
                readOnly={!canEditOrdersPageSize}
                className="h-8 w-20 bg-background/50 text-foreground"
              />
              {(() => {
                const v = Number(ordersPageSizeInput);
                const isValid = Number.isFinite(v) && v >= 1;
                const isChanged =
                  ordersPageSizeInput !== "" && String(Math.floor(v)) !== String(ordersPageSize);

                return (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (!canEditOrdersPageSize || !isValid || !isChanged) return;
                      const final = Math.min(1000, Math.floor(v));
                      setOrdersPageSize(final);
                      setOrdersPageSizeInput(String(final));
                      setOrdersPage(0);
                    }}
                    disabled={!canEditOrdersPageSize || !isValid || !isChanged}
                    className="h-8 px-4"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Confirmar
                  </Button>
                );
              })()}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOrdersPage(0)}
                disabled={!hasPreviousPage || !canEditOrdersPageSize}
                className="h-9 rounded-full px-4"
              >
                Principio
              </Button>
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/50 px-3 py-1 text-sm text-foreground shadow-sm">
                {Array.from({ length: totalOrdersPages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`rounded-full px-3 py-1 ${index === ordersPage ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-2"}`}
                    onClick={() => setOrdersPage(index)}
                    disabled={!canEditOrdersPageSize}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOrdersPage(totalOrdersPages - 1)}
                disabled={!hasNextPage || !canEditOrdersPageSize}
                className="h-9 rounded-full px-4"
              >
                Último
              </Button>
            </div>
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
        </main>
      );
    }

    if (activeTab === "profile") {
      return userName ? (
        <div className="space-y-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <User className="size-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Perfil</h2>
              <p className="text-sm text-muted-foreground">Actualizá tus datos personales.</p>
            </div>
          </div>
          <div className="grid max-w-4xl gap-5">
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2.5">
                <Label htmlFor="account-name" className="text-sm font-medium text-foreground">Nombre</Label>
                <Input
                  id="account-name"
                  value={userGivenName}
                  onChange={(e) => setUserGivenName(e.target.value)}
                  placeholder="Nombre"
                  className="h-10 border-border/60"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="account-last-name" className="text-sm font-medium text-foreground">Apellido</Label>
                <Input
                  id="account-last-name"
                  value={userFamilyName}
                  onChange={(e) => setUserFamilyName(e.target.value)}
                  placeholder="Apellido"
                  className="h-10 border-border/60"
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="account-doc" className="text-sm font-medium text-foreground">Documento</Label>
                <Input id="account-doc" value={userDocument} onChange={(e) => setUserDocument(e.target.value)} placeholder="Ingresá tu documento" className="h-10 border-border/60" />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2.5">
                <Label htmlFor="account-email" className="text-sm font-medium text-foreground">Email</Label>
                <Input id="account-email" type="email" value={userEmail} disabled className="h-10 border-border/60 bg-muted/50 text-foreground opacity-60" />
                <p className="text-xs text-muted-foreground leading-relaxed">Email de acceso, no se puede modificar desde aquí.</p>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="account-phone" className="text-sm font-medium text-foreground">Teléfono</Label>
                <Input id="account-phone" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} placeholder="Ingresá tu teléfono" className="h-10 border-border/60" />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="account-primary-address" className="text-sm font-medium text-foreground">Dirección</Label>
                <Input
                  id="account-primary-address"
                  value={primaryAddress?.value ?? "Sin dirección principal"}
                  disabled
                  className="h-10 border-border/60 bg-muted/50 text-foreground opacity-80"
                />
              </div>
            </div>

            <Button
              className="sm:w-fit h-10 px-6"
              disabled={isSavingProfile}
              onClick={async () => {
                setIsSavingProfile(true);
                try {
                  const nextEmail = userEmail.trim();
                  const nextName = userGivenName.trim();
                  const nextFamily = userFamilyName.trim();
                  const nextFullName = [nextName, nextFamily].filter(Boolean).join(" ");
                  const success = await updateUserProfile({
                    data: {
                      userId: user?.id || "",
                      email: nextEmail,
                      givenName: nextName,
                      familyName: nextFamily,
                      phone: userPhone,
                      document: userDocument,
                    },
                  });
                  if (success) {
                    setUserName(nextFullName || nextEmail || user?.email || null);
                    await saveKindeUserToTurso({
                      id: user?.id || "",
                      email: nextEmail || user?.email || null,
                      givenName: nextName || null,
                      familyName: nextFamily || null,
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
              {isSavingProfile ? "Guardando..." : <><Check className="mr-2 size-4 text-current" /> Guardar cambios</>}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center text-base text-muted-foreground py-10">
          Inicia sesión para ver y editar tu perfil.
        </div>
      );
    }

    if (activeTab === "addresses") {
      return userName ? (
        <div className="space-y-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Direcciones</h2>
              <p className="text-sm text-muted-foreground">Agregá, editá o borrá tus direcciones de envío.</p>
            </div>
            <Button
              size="lg"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setShowAddForm((current) => !current);
                setEditingIndex(null);
                setAddressLabel("");
                setAddressValue("");
                setAddressSuggestions([]);
              }}
            >
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
              {addressValue.trim() && (
                <div className="mt-5">
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/60">
                    <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Verificación de ubicación</span>
                      <MapPin className="size-3.5" />
                    </div>
                    {isMapLoading ? (
                      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                        Buscando ubicación…
                      </div>
                    ) : mapPreviewUrl ? (
                      <iframe
                        title="Mapa de la dirección"
                        src={mapPreviewUrl}
                        className="h-52 w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <div className="flex h-52 items-center justify-center px-4 text-center text-sm text-muted-foreground">
                        No encontramos una ubicación precisa para esa dirección. Revisá el texto o agregá barrio, ciudad y país.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={async () => {
                    if (!addressLabel.trim() || !addressValue.trim()) {
                      toast.error("Por favor completa etiqueta y dirección");
                      return;
                    }
                    if (!user?.id) {
                      toast.error("Error: usuario no identificado");
                      return;
                    }
                    try {
                      const result = await saveUserAddress({
                        data: {
                          userId: user.id,
                          label: addressLabel.trim(),
                          value: addressValue,
                          isPrimary: addresses.length === 0 || !addresses.some((address) => address.isPrimary),
                        },
                      });
                      if (result && result.id) {
                        setAddresses((current) => [
                          ...current,
                          {
                            id: result.id,
                            label: result.label,
                            value: result.value,
                            isPrimary: result.isPrimary ?? false,
                          },
                        ]);
                        setAddressLabel("");
                        setAddressValue("");
                        setMapPreviewUrl(null);
                        setAddressSuggestions([]);
                        setShowAddForm(false);
                        toast.success("Dirección guardada correctamente");
                      } else {
                        toast.error("Error al guardar la dirección");
                      }
                    } catch (error) {
                      console.error("Error guardando dirección:", error);
                      toast.error("Error al guardar la dirección");
                    }
                  }}
                >
                  <Save className="mr-2 size-4 text-current" /> Guardar
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  className="h-11 px-5"
                  onClick={() => {
                    setShowAddForm(false);
                    setAddressLabel("");
                    setAddressValue("");
                  }}
                >
                  ✕ Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {addresses.map((address, index) => (
              <div key={`${address.label}-${index}`} className="rounded-2xl border border-border/60 bg-background/50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-full">
                    <div className="flex items-center gap-3">
                      <div className="relative grid size-10 place-items-center rounded-xl bg-sky-500/10 text-sky-400 ring-1 ring-sky-400/25">
                        <MapPin className="size-4" />
                        <span className="absolute bottom-1 right-1 text-[7px] font-bold leading-none tracking-[0.12em] text-sky-300">
                          {getAddressBadge(address.label)}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground">{address.label}</h3>
                    </div>
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
                        {addressValue.trim() && (
                          <div className="mt-2 overflow-hidden rounded-2xl border border-border/60 bg-background/60">
                            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                              <span>Verificación de ubicación</span>
                              <MapPin className="size-3.5" />
                            </div>
                            {isMapLoading ? (
                              <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                                Buscando ubicación…
                              </div>
                            ) : mapPreviewUrl ? (
                              <iframe
                                title="Mapa de la dirección editada"
                                src={mapPreviewUrl}
                                className="h-40 w-full border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                              />
                            ) : (
                              <div className="flex h-40 items-center justify-center px-4 text-center text-xs text-muted-foreground">
                                No encontramos una ubicación precisa.
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-1">
                          <Button
                            size="lg"
                            className="h-11 px-5 bg-[#39a9de] text-white hover:bg-[#2f9ed3]"
                            onClick={async () => {
                              if (!addressLabel.trim() || !addressValue.trim()) return;
                              const addressToUpdate = addresses[index];
                              if (!addressToUpdate?.id || !user?.id) {
                                setAddresses((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: addressLabel.trim(), value: addressValue.trim() } : item,
                                  ),
                                );
                                setEditingIndex(null);
                                setAddressLabel("");
                                setAddressValue("");
                                setMapPreviewUrl(null);
                                return;
                              }

                              const success = await updateUserAddress({
                                data: {
                                  userId: user.id,
                                  addressId: addressToUpdate.id,
                                  label: addressLabel.trim(),
                                  value: addressValue,
                                },
                              });

                              if (success) {
                                setAddresses((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, label: addressLabel.trim(), value: addressValue.trim() } : item,
                                  ),
                                );
                                toast.success("Dirección actualizada");
                              } else {
                                toast.error("Error al actualizar la dirección");
                              }

                              setEditingIndex(null);
                              setAddressLabel("");
                              setAddressValue("");
                              setMapPreviewUrl(null);
                            }}
                          >
                            <Save className="mr-2 size-4 text-current" /> Guardar
                          </Button>
                          <Button variant="destructive" size="lg" className="h-11 px-5" onClick={() => { setEditingIndex(null); setAddressLabel(""); setAddressValue(""); }}>
                            ✕ Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-3 text-sm text-muted-foreground">{address.value}</p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          <Button
                            variant={address.isPrimary ? "secondary" : "outline"}
                            size="sm"
                            className="gap-2 h-9 px-5"
                            onClick={async () => {
                              if (!address.id || !user?.id) return;
                              const success = await setPrimaryUserAddress({ data: { userId: user.id, addressId: address.id } });
                              if (success) {
                                setAddresses((current) => current.map((item) => ({ ...item, isPrimary: item.id === address.id })));
                                toast.success("Dirección principal actualizada");
                              } else {
                                toast.error("No se pudo actualizar la dirección principal");
                              }
                            }}
                          >
                            {address.isPrimary ? <Check className="size-4 text-current" /> : <MapPin className="size-4" />} {address.isPrimary ? "Principal" : "Marcar principal"}
                          </Button>
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
        <div className="text-center text-base text-muted-foreground py-10">
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
          <div className="flex flex-col items-center gap-3 text-center py-14">
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
        <div className="text-center text-base text-muted-foreground py-10">
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

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
            <div className="min-h-[calc(100vh-8rem)]">
              {renderAccountContent()}
            </div>
          </div>
          <BrandFooter brand={webDesignConfig} section="account" />
        </main>
      </div>

      <ConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} title="¿Cerrar sesión?" description="¿Estás seguro de que deseas cerrar sesión?" confirmLabel="Sí, cerrar sesión" cancelLabel="No" onConfirm={async () => { await kindeLogout(); if (typeof window !== "undefined") { window.sessionStorage.removeItem("lrg_auth_role"); } navigate({ to: "/login", replace: true }); }} />
    </div>
  );
}
