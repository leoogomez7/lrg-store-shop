import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Boxes, Layers, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { motion } from "motion/react";
import { BrandMark } from "@/components/common/brand-mark";
import { Reveal } from "@/components/common/motion-primitives";
import { Button } from "@/components/ui/button";
import { brandList } from "@/config/brands";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { SectorsContent } from "@/components/sectors-content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LRG Store Shop — Ecosistema de marcas premium" },
      {
        name: "description",
        content:
          "Un ecosistema, tres sectores: gaming, perfumería árabe y software. Elegí tu marca y viví una experiencia de compra distinta.",
      },
      { property: "og:title", content: "LRG Store Shop — Ecosistema de marcas premium" },
      {
        property: "og:description",
        content: "Un ecosistema, tres sectores: gaming, perfumería árabe y software. Elegí tu marca y viví una experiencia de compra distinta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WelcomePage,
});

const pillars = [
  { icon: Layers, label: "Tres sectores, un mismo sistema" },
  { icon: Zap, label: "Navegación instantánea" },
  { icon: ShieldCheck, label: "Compras protegidas" },
  { icon: Boxes, label: "Arquitectura escalable" },
];

function WelcomePage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setUserName(window.sessionStorage.getItem("userName"));
    } catch (e) {
      setUserName(null);
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === "userName") setUserName(window.sessionStorage.getItem("userName"));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function UserBadge() {
    const [name, setName] = useState<string | null>(null);
    const [panel, setPanel] = useState<string | null>(null);

    useEffect(() => {
      try {
        setName(sessionStorage.getItem("userName"));
        setPanel(sessionStorage.getItem("activePanel"));
      } catch (e) {
        setName(null);
        setPanel(null);
      }
    }, []);

    if (!panel) return null;

    const roleLabel = panel === "admin" ? "Administrador" : "Cliente";
    const displayName = name || (panel === "admin" ? "Administrador" : "Usuario");

    return (
      <div className="ml-2 flex items-center gap-2">
        <div className="px-2 py-1 rounded-md bg-green-50 text-green-800 text-sm font-medium">{displayName}</div>
        <div className="px-2 py-1 rounded-md bg-green-600 text-white text-xs font-semibold">{roleLabel}</div>
      </div>
    );
  }

  function handleBrandClick(e: any) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate({ to: "/" });
    }
  }
  return (
    <div className="theme-webdesign relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="aurora-bg" />
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6">
        <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <a href="/" onClick={handleBrandClick} aria-label="Ir al inicio">
              <BrandMark />
            </a>
            <nav className="flex items-center gap-2">
              <Link
                to="/cuenta"
                onClick={() => {
                  try {
                    sessionStorage.setItem("activePanel", "client");
                    if (!sessionStorage.getItem("userName")) sessionStorage.setItem("userName", "Cliente LRG");
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="text-sm font-medium px-2 py-1 rounded hover:bg-surface-2"
              >
                Mi cuenta
              </Link>
              <Link
                to="/admin"
                onClick={() => {
                  try {
                    sessionStorage.setItem("activePanel", "admin");
                    if (!sessionStorage.getItem("userName")) sessionStorage.setItem("userName", "Administrador");
                  } catch (e) {
                    /* ignore */
                  }
                }}
                className="text-sm font-medium px-2 py-1 rounded hover:bg-surface-2"
              >
                Panel administrativo
              </Link>
              <UserBadge />
              {userName && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 ml-2"
                  onClick={async () => {
                    try {
                      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                    } catch (e) {
                      /* ignore */
                    }
                    if (typeof window !== "undefined") {
                      window.localStorage.clear();
                      window.sessionStorage.clear();
                    }
                    navigate({ to: "/" });
                  }}
                >
                  Cerrar sesión
                </Button>
              )}
            </nav>
          </div>
        </header>
        <div className="h-16" aria-hidden />

        <main className="flex flex-1 flex-col justify-center py-16">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="glass inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-xs tracking-[0.16em] text-muted-foreground uppercase"
          >
            <Sparkles className="size-3.5 text-primary" />
            Bienvenido al ecosistema
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-4xl text-4xl leading-[1.05] font-semibold sm:text-6xl lg:text-7xl"
          >
            Una plataforma.
            <br />
            <span className="text-gradient-brand">Tres formas de comprar.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            LRG Store Shop reúne gaming, perfumería árabe y desarrollo de software bajo un mismo
            sistema. Elegís el sector y toda la experiencia se adapta a esa marca.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2">
                  Elegir sector <ArrowRight className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <SectorsContent />
              </DialogContent>
            </Dialog>
          </motion.div>

          <Reveal delay={0.3} className="mt-16">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map((pillar) => (
                <li key={pillar.label} className="glass-panel flex items-center gap-3 rounded-xl p-4">
                  <span className="gradient-brand grid size-9 shrink-0 place-items-center rounded-lg">
                    <pillar.icon className="size-4 text-primary-foreground" />
                  </span>
                  <span className="text-sm text-muted-foreground">{pillar.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6 pb-2 text-xs text-muted-foreground">
          <a href="/" onClick={handleBrandClick} className="hover:underline">© {new Date().getFullYear()} LRG Store Shop</a>
          <span className="flex flex-wrap gap-4">
            {brandList.map((brand) => (
              <Link
                key={brand.slug}
                to="/$brand"
                params={{ brand: brand.slug }}
                className="transition-colors hover:text-foreground"
              >
                {brand.name}
              </Link>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}
