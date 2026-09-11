import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { KindeProvider, useKindeAuth } from "@kinde-oss/kinde-auth-react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/error-reporting";
import { hasTursoAdminConfig, hasTursoConfig } from "../lib/db";
import { CartProvider } from "../store/cart";
import { Toaster } from "../components/ui/sonner";
import { Badge } from "../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { formatDate } from "../lib/format";
import { LoadingState } from "@/components/common/loading-state";
import { getKindeConfig, getKindeRedirectUri, hasKindeConfig } from "../lib/kinde";
import {
  applyAdminSettings,
  brandList,
  getBrandContactPresentation,
  getStoreShopContact,
  refreshBrandData,
} from "../config/brands";
import {
  ensureAdminSettings,
  initializeDatabase,
  loadAdminSettings,
  recordSiteVisit,
} from "../server/persistence";
import { orderQueries } from "../services/catalog.service";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

class RootErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  override state: { hasError: boolean } = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Root error boundary caught an exception", error, errorInfo);
    reportClientError(error, { boundary: "tanstack_root_error_boundary", errorInfo });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              This page didn't load
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Something went wrong on our end. You can try refreshing or head back home.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <a
                href="/"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Go home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "LRG Store Shop" },
      {
        name: "description",
        content:
          "Un negocio, tres sectores: gaming, perfumería árabe y software. Conectá con tus pasiones y descubrí una nueva forma de pontenciar tu día a día.",
      },
      { name: "author", content: "LRG" },
      { property: "og:title", content: "LRG Store Shop" },
      {
        property: "og:description",
        content:
          "Un negocio, tres sectores: gaming, perfumería árabe y software. Conectá con tus pasiones y descubrí una nueva forma de pontenciar tu día a día.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "LRG Store Shop" },
      {
        name: "twitter:description",
        content:
          "Un negocio, tres sectores: gaming, perfumería árabe y software. Conectá con tus pasiones y descubrí una nueva forma de pontenciar tu día a día.",
      },
      { property: "og:image", content: "/LRG Store Shop PNG.png" },
      { name: "twitter:image", content: "/LRG Store Shop PNG.png" },
    ],
    links: [
      {
        rel: "icon",
        href: "/LRG Store Shop PNG.png",
        type: "image/png",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <>
      <HeadContent />
      {children}
      <Scripts />
    </>
  );
}

function AuthenticatedCart({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useKindeAuth();
  return (
    <CartProvider
      user={user ? (user.email ? { id: user.id, email: user.email } : { id: user.id }) : null}
      isAuthenticated={isAuthenticated}
      isLoading={isLoading}
    >
      {children}
      <CustomerOrderStatusNotice />
    </CartProvider>
  );
}

type CustomerOrderStatusChange = {
  id: string;
  date: string;
  deliveryStatus: string;
  paymentStatus: string;
  previousDeliveryStatus: string;
  previousPaymentStatus: string;
};

function CustomerOrderStatusNotice() {
  const { user, isAuthenticated } = useKindeAuth();
  const { data: orders = [] } = useQuery({
    ...orderQueries.list(),
    enabled: Boolean(isAuthenticated && user?.email),
  });
  const [changes, setChanges] = useState<CustomerOrderStatusChange[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated || !user?.email) return;
    if (window.sessionStorage.getItem("lrg_auth_role") === "admin") return;

    const accountEmail = user.email.trim().toLowerCase();
    const noticeShownKey = `lrg_customer_order_status_notice_shown:${accountEmail}`;
    if (window.sessionStorage.getItem(noticeShownKey) === "true") return;

    const snapshotKey = `lrg_customer_order_status_snapshot:${accountEmail}`;
    const previousSnapshotRaw = window.localStorage.getItem(snapshotKey);
    const previousSnapshot = previousSnapshotRaw
      ? (JSON.parse(previousSnapshotRaw) as Record<
          string,
          { deliveryStatus?: string; paymentStatus?: string }
        >)
      : {};

    const nextSnapshot = Object.fromEntries(
      orders
        .filter((order) => order.email.toLowerCase() === accountEmail)
        .map((order) => [
          order.id,
          {
            deliveryStatus: order.deliveryStatus ?? "Pendiente",
            paymentStatus: order.paymentStatus ?? "Pendiente",
          },
        ]),
    );

    const nextChanges = orders
      .filter((order) => order.email.toLowerCase() === accountEmail)
      .filter((order) => {
        const previous = previousSnapshot[order.id];
        return (
          previous &&
          ((previous.deliveryStatus ?? "Pendiente") !== (order.deliveryStatus ?? "Pendiente") ||
            (previous.paymentStatus ?? "Pendiente") !== (order.paymentStatus ?? "Pendiente"))
        );
      })
      .map((order) => {
        const previous = previousSnapshot[order.id];
        return {
          id: order.id,
          date: order.date,
          deliveryStatus: order.deliveryStatus ?? "Pendiente",
          paymentStatus: order.paymentStatus ?? "Pendiente",
          previousDeliveryStatus: previous?.deliveryStatus ?? "Pendiente",
          previousPaymentStatus: previous?.paymentStatus ?? "Pendiente",
        };
      });

    window.localStorage.setItem(snapshotKey, JSON.stringify(nextSnapshot));
    if (nextChanges.length > 0) {
      window.sessionStorage.setItem(noticeShownKey, "true");
      setChanges(nextChanges);
    }
  }, [isAuthenticated, orders, user?.email]);

  return (
    <Dialog open={changes.length > 0} onOpenChange={(open) => !open && setChanges([])}>
      <DialogContent className="max-w-2xl overflow-hidden border-primary/40 bg-background/95 p-0 shadow-2xl shadow-primary/20">
        <div className="h-2 bg-primary" />
        <div className="p-6 sm:p-8">
          <DialogHeader>
            <div className="mb-3 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-primary/15 text-primary">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <DialogTitle>Actualización de tus compras</DialogTitle>
                <DialogDescription>
                  Se actualizaron el envío o el pago de algunas compras.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-5 space-y-3">
            {changes.map((change) => (
              <div key={change.id} className="rounded-xl border border-border/60 bg-surface/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Pedido {change.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(change.date)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      Envío: {change.previousDeliveryStatus} → {change.deliveryStatus}
                    </Badge>
                    <Badge variant="outline">
                      Pago: {change.previousPaymentStatus} → {change.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { clientId, domain } = getKindeConfig();
  const redirectUri = getKindeRedirectUri("/login");
  const logoutUri = getKindeRedirectUri("/");
  const hasKindConfig = hasKindeConfig();

  useEffect(() => {
    if (!hasTursoConfig() && !hasTursoAdminConfig()) {
      return;
    }

    const brandPresentations = Object.fromEntries(
      brandList.map((brand) => [brand.slug, getBrandContactPresentation(brand.slug)]),
    );
    void initializeDatabase({ data: {} })
      .then(() =>
        ensureAdminSettings({
          data: {
            settings: [
              {
                settingKey: "lrg-store-shop-contact-v1",
                settingValue: JSON.stringify(getStoreShopContact()),
              },
              {
                settingKey: "lrg-brand-contact-presentation-v1",
                settingValue: JSON.stringify(brandPresentations),
              },
            ],
          },
        }),
      )
      .then(() => loadAdminSettings({ data: {} }))
      .then((settings) => {
        applyAdminSettings(settings);
        refreshBrandData();
        window.dispatchEvent(new Event("lrg-brand-data-updated"));
      })
      .catch((error) => {
        console.error("No se pudo inicializar la base de datos de Turso:", error);
      });
  }, []);

  useEffect(() => {
    if (!hasTursoAdminConfig()) {
      return;
    }

    const match = document.cookie.match(/(?:^|; )lrg_visitor_id=([^;]+)/);
    const visitorId = match?.[1] ? decodeURIComponent(match[1]) : crypto.randomUUID();
    if (!match?.[1]) {
      document.cookie = `lrg_visitor_id=${encodeURIComponent(visitorId)}; Max-Age=31536000; Path=/; SameSite=Lax`;
    }
    void recordSiteVisit({ data: { visitorId } });
  }, []);

  const appContent = (
    <QueryClientProvider client={queryClient}>
      <AuthenticatedCart>
        <Suspense fallback={<LoadingState />}>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </Suspense>
        <Toaster position="top-right" />
      </AuthenticatedCart>
    </QueryClientProvider>
  );

  if (!hasKindConfig) {
    return (
      <QueryClientProvider client={queryClient}>
        <CartProvider>
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
          <Toaster position="top-right" />
        </CartProvider>
      </QueryClientProvider>
    );
  }

  return (
    <RootErrorBoundary>
      <KindeProvider
        clientId={clientId}
        domain={domain}
        redirectUri={redirectUri ?? "http://localhost:5174/login"}
        logoutUri={logoutUri ?? "http://localhost:5174/"}
      >
        {appContent}
      </KindeProvider>
    </RootErrorBoundary>
  );
}
