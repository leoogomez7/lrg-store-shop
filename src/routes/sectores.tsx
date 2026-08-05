import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { Reveal } from "@/components/common/motion-primitives";
import { Button } from "@/components/ui/button";
import { brandList } from "@/config/brands";

export const Route = createFileRoute("/sectores")({
  head: () => ({
    meta: [
      { title: "Elegí tu sector — LRG Store Shop" },
      {
        name: "description",
        content:
          "Arcade para gaming, Scents para perfumería árabe y Web Design para software. Cada sector con su propia identidad y catálogo.",
      },
      { property: "og:title", content: "Elegí tu sector — LRG Store Shop" },
      {
        property: "og:description",
        content: "Tres sectores independientes dentro del ecosistema LRG Store Shop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SectorsContent,
});
export function SectorsContent() {
  const navigate = useNavigate();

  function handleBrandClick(e: any) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.location.pathname === "/") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      navigate({ to: "/" });
    }
  }
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="aurora-bg" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <header className="flex items-center justify-between">
          <a href="/" onClick={handleBrandClick} aria-label="Ir al inicio">
            <BrandMark />
          </a>
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/">
              <ArrowLeft className="size-4" /> Volver
            </Link>
          </Button>
        </header>

        <div className="mx-auto mt-16 max-w-2xl text-center">
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Nivel 2</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">Elegí tu sector</h1>
          <p className="mt-4 text-muted-foreground">
            Cada marca tiene su propio diseño, catálogo y tono. Podés cambiar de sector en cualquier
            momento sin perder tu carrito.
          </p>
        </div>

        <div className="mt-14 grid gap-6 pb-20 lg:grid-cols-3">
          {brandList.map((brand, index) => (
            <Reveal key={brand.slug} delay={index * 0.08}>
              <Link
                to="/$brand"
                params={{ brand: brand.slug }}
                className={`${brand.theme} group glass-panel hover-lift relative flex h-full flex-col overflow-hidden rounded-3xl p-7`}
              >
                <span className="gradient-brand pointer-events-none absolute inset-x-0 top-0 h-1" />
                <span className="gradient-brand grid size-12 place-items-center rounded-2xl text-lg font-semibold text-primary-foreground">
                  {brand.shortName.slice(0, 2).toUpperCase()}
                </span>
                <h2 className="font-display mt-6 text-2xl font-semibold">{brand.name}</h2>
                <p className="mt-1 text-sm text-primary">{brand.tagline}</p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {brand.description}
                </p>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {brand.categories.slice(0, 4).map((category) => (
                    <li
                      key={category.slug}
                      className="glass rounded-full px-3 py-1 text-xs text-muted-foreground"
                    >
                      {category.name}
                    </li>
                  ))}
                </ul>
                <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  Entrar al sector
                  <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
