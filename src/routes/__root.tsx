import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { KindeProvider, useKindeAuth } from "@kinde-oss/kinde-auth-react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Component, Suspense, useEffect, type ErrorInfo, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/error-reporting";
import { CartProvider } from "../store/cart";
import { Toaster } from "../components/ui/sonner";
import { getKindeConfig, getKindeRedirectUri, hasKindeConfig } from "../lib/kinde";
import {
  applyAdminSettings,
  brandList,
  getBrandContactPresentation,
  getStoreShopContact,
  refreshBrandData,
} from "../config/brands";
import { ensureAdminSettings, loadAdminSettings, recordSiteVisit } from "../server/persistence";

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
    </CartProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { clientId, domain } = getKindeConfig();
  const redirectUri = getKindeRedirectUri("/dashboard");
  const logoutUri = getKindeRedirectUri("/login");
  const hasKindConfig = hasKindeConfig();

  useEffect(() => {
    const brandPresentations = Object.fromEntries(
      brandList.map((brand) => [brand.slug, getBrandContactPresentation(brand.slug)]),
    );
    void ensureAdminSettings({
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
    })
      .then(() => loadAdminSettings({ data: {} }))
      .then((settings) => {
        applyAdminSettings(settings);
        refreshBrandData();
        window.dispatchEvent(new Event("lrg-brand-data-updated"));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
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
        <Suspense fallback={<div>Loading...</div>}>
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
          <Suspense fallback={<div>Loading...</div>}>
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
        redirectUri={redirectUri ?? "http://localhost:5174/dashboard"}
        logoutUri={logoutUri ?? "http://localhost:5174/login"}
      >
        {appContent}
      </KindeProvider>
    </RootErrorBoundary>
  );
}
