import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { BrandMark } from "@/components/common/brand-mark";
import { Reveal } from "@/components/common/motion-primitives";
import { Button } from "@/components/ui/button";
import { brandList } from "@/config/brands";

function getBrandLogo(slug: string) {
  switch (slug) {
    case "arcade":
      return "/LRG Arcade PNG.png";
    case "scents":
      return "/LRG Scents PNG.png";
    case "web-design":
      return "/LRG Web Design PNG.png";
    default:
      return "/LRG Store Shop PNG.png";
  }
}

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
            <Link to="/cuenta">
              <ArrowUpRight className="size-4" /> Volver
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
          {brandList.map((brand, index) => {
            const logoSrc = getBrandLogo(brand.slug);
            return (
              <Reveal key={brand.slug} delay={index * 0.08}>
                <Link
                  to="/$brand"
                  params={{ brand: brand.slug }}
                  className={`${brand.theme} group glass-panel hover-lift relative flex h-full flex-col items-start justify-between overflow-hidden rounded-3xl p-7 text-left`}
                >
                  <span className="gradient-brand pointer-events-none absolute inset-x-0 top-0 h-1" />
                  <div className="flex flex-col gap-4">
                    <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 shadow-sm">
                      <img src={logoSrc} alt={brand.name} className="max-h-10 max-w-full object-contain" />
                    </span>
                    <div>
                      <h2 className="font-display text-xl font-semibold text-foreground">{brand.name}</h2>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-primary">{brand.tagline}</p>
                        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ir a la web</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SectorsContent;
