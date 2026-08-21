import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Boxes, Layers, ShieldCheck, Sparkles, Star, Zap } from "lucide-react";
import { useKindeAuth } from "@kinde-oss/kinde-auth-react";
import { KindeAuthGate } from "@/components/common/kinde-auth-gate";
import { Reveal } from "@/components/common/motion-primitives";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandHeader } from "@/components/layout/brand-header";
import { BrandFooter } from "@/components/layout/brand-footer";
import { getStoreShopContact } from "@/config/brands";
import { webDesignConfig } from "@/config/brands/web-design.config";
import { getStoredActivePanel, getStoredUserDisplayName } from "@/lib/auth";
import { SectorsContent } from "@/components/sectors-content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LRG Store Shop" },
      {
        name: "description",
        content:
          "Un negocio, tres sectores: gaming, perfumería árabe y software. Conectá con tus pasiones y descubrí una nueva forma de pontenciar tu día a día.",
      },
      { property: "og:title", content: "LRG Store Shop" },
      {
        property: "og:description",
        content: "Un negocio, tres sectores: gaming, perfumería árabe y software. Conectá con tus pasiones y descubrí una nueva forma de pontenciar tu día a día.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "icon", href: "/LRG Store Shop PNG.png", type: "image/png" }],
  }),
  component: WelcomePage,
});

const pillars = [
  { icon: Layers, label: "Tres sectores, un mismo negocio" },
  { icon: Zap, label: "Navegación instantánea" },
  { icon: ShieldCheck, label: "Compras protegidas" },
  { icon: Boxes, label: "Arquitectura escalable" },
];

const trustpilotReviews = [
  {
    name: "Walter Victor Ramirez",
    title: "Mí opinión es buena ya que el producto es recomendable.",
    text: "Mí opinión es buena ya que el producto es súper económico y funcióna muy bien. Fácil de crearlo y súper explicado de parte del vendedor. No hay quejas algunas así que súper recomendable.",
    rating: 5,
    date: "28 de octubre de 2022",
    url: "https://es.trustpilot.com/users/635be4d971707b001320768e",
  },
  {
    name: "Diizr _",
    title: "Sencillo, rapido y confiable que mas queres",
    text: "Muy buena mi experiencia comprando, no es la primera vez que compro plus y nunca hubo mayor problema con el servicio, siempre atento ante cualquier consulta y responde bien",
    rating: 5,
    date: "3 de septiembre de 2023",
    url: "https://es.trustpilot.com/users/64f4ff79ee59660013fee5e4",
  },
  {
    name: "Guille",
    title: "Muy confíable",
    text: "Es un sitio confíable, ya hice varias compras y no tuve problemas. sigan trabajando así 👌",
    rating: 5,
    date: "29 de septiembre de 2023",
    url: "https://es.trustpilot.com/reviews/651717ca02faaee777613144",
  },
  {
    name: "Alejandro Rouseau",
    title: "Ya es la 3er cuenta que compro..",
    text: "Ya es la 3er cuenta que compro... y como siempre EXCELENTE... muchas gracias",
    rating: 5,
    date: "4 de junio de 2024",
    url: "https://es.trustpilot.com/reviews/665e69ab576f5b31c32b62f3",
  },
  {
    name: "itzdragonsyt",
    title: "Explendido",
    text: "Fue una experiencia bastante buena , una buena atención y el juego me llego muy rapido!. Con precios muy accesibles , un lujo la verdad. Recomendado totalmente",
    rating: 5,
    date: "22 de febrero de 2025",
    url: "https://es.trustpilot.com/users/67ba517930e5fe53f29882f6",
  },
  {
    name: "Ricardo Erazo",
    title: "Muy buen servicio",
    text: "Muy buen servicio, entrega a tiempo",
    rating: 4,
    date: "14 de agosto de 2025",
    url: "https://es.trustpilot.com/reviews/689e0c56fc2e7996857f5dd3",
  },
  {
    name: "itzdragonsyt",
    title: "Excelente servicio muy recomendable…",
    text: "Excelente servicio muy recomendable siempre conpri aqui",
    rating: 5,
    date: "27 de enero de 2026",
    url: "https://es.trustpilot.com/reviews/69791760404cf879b3cdb350",
  },
];

const trustpilotUrl = "https://es.trustpilot.com/review/psplusargentinaps4.empretienda.com.ar";
const trustpilotUrl_Evaluate = "https://es.trustpilot.com/evaluate/psplusargentinaps4.empretienda.com.ar";

function WelcomePage() {
  return (
    <KindeAuthGate fallback={<WelcomePageContent auth={null} />}>
      {(auth) => <WelcomePageContent auth={auth} />}
    </KindeAuthGate>
  );
}

function WelcomePageContent({ auth }: { auth: ReturnType<typeof useKindeAuth> | null }) {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout: kindeLogout } = auth ?? {
    isAuthenticated: false,
    user: null,
    logout: async () => undefined,
  };
  const [sortBy, setSortBy] = useState<"date" | "rating">("date");
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const storeShopContact = getStoreShopContact();

  function parseSpanishDate(dateStr: string): Date {
    const months: { [key: string]: number } = {
      enero: 1,
      febrero: 2,
      marzo: 3,
      abril: 4,
      mayo: 5,
      junio: 6,
      julio: 7,
      agosto: 8,
      septiembre: 9,
      octubre: 10,
      noviembre: 11,
      diciembre: 12,
    };

    const parts = dateStr.split(" de ");
    const day = parseInt(parts[0]);
    const month = months[parts[1].toLowerCase()];
    const year = parseInt(parts[2]);

    return new Date(year, month - 1, day);
  }

  const sortedReviews = [...trustpilotReviews].sort((a, b) => {
    if (sortBy === "rating") {
      const diff = b.rating - a.rating;
      return sortDirection === "highest" ? diff : -diff;
    } else {
      // Ordenar por fecha
      const dateA = parseSpanishDate(a.date).getTime();
      const dateB = parseSpanishDate(b.date).getTime();
      const diff = dateB - dateA;
      return sortDirection === "newest" ? diff : -diff;
    }
  });

  return (
    <div className="theme-webdesign relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="aurora-bg" />
      <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pt-16 pb-8 sm:px-6">
        <BrandHeader brand={webDesignConfig} displayBrandName="LRG Store Shop" logoBrandSlug="store-shop" />
        <main className="flex flex-1 flex-col justify-start py-8">
          <span
            className="glass inline-flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-xs tracking-[0.16em] text-muted-foreground uppercase opacity-100"
            style={{ transition: "opacity 600ms ease" }}
          >
            <Sparkles className="size-3.5 text-primary" />
            Bienvenido LRG Store Shop
          </span>

          <h1
            className="mt-6 max-w-4xl text-4xl leading-[1.05] font-semibold sm:text-6xl lg:text-7xl"
            style={{ transition: "transform 700ms ease, opacity 700ms ease", transform: "translateY(0)", opacity: 1 }}
          >
            Una plataforma.
            <br />
            <span className="text-gradient-brand">Tres formas de comprar.</span>
          </h1>

          <p
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            style={{ transition: "transform 700ms ease, opacity 700ms ease", transform: "translateY(0)", opacity: 1 }}
          >
            LRG Store Shop reúne gaming, streaming, perfumería árabe y diseño de páginas web
            bajo un mismo sistema. Elegís el sector y toda la experiencia se adapta a esa marca.
          </p>

          <div
            className="mt-10 flex flex-wrap items-center gap-3"
            style={{ transition: "transform 700ms ease, opacity 700ms ease", transform: "translateY(0)", opacity: 1 }}
          >
            <Button 
              onClick={() => navigate({ to: "/$brand", params: { brand: "arcade" } })}
              size="lg" 
              className="gap-2"
            >
              LRG Arcade <ArrowRight className="size-4" />
            </Button>
            <Button 
              onClick={() => navigate({ to: "/$brand", params: { brand: "scents" } })}
              size="lg" 
              className="gap-2"
            >
              LRG Scents <ArrowRight className="size-4" />
            </Button>
            <Button 
              onClick={() => navigate({ to: "/$brand", params: { brand: "web-design" } })}
              size="lg" 
              className="gap-2"
            >
              LRG Web Design <ArrowRight className="size-4" />
            </Button>
            <Button
              onClick={() => navigate({ to: "/productos" })}
              size="lg"
              className="gap-2 bg-surface-2 text-foreground hover:bg-surface-3"
            >
              Mostrar todos los productos <ArrowRight className="size-4" />
            </Button>
          </div>

          <section className="mt-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border/60 bg-surface/90 p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-primary">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="size-4 fill-current" />
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-foreground">Reseñas verificadas en Trustpilot</p>
                    <p className="text-xs text-muted-foreground">4.9/5 según clientes reales · +24 opiniones</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <a
                    href={trustpilotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1 rounded-2xl border border-border/70 bg-surface/90 px-3 text-sm font-semibold leading-none text-primary transition duration-200 hover:border-primary/70 hover:bg-background/95 hover:text-primary"
                  >
                    Ver más opiniones
                    <ArrowUpRight className="size-4" />
                  </a>
                  <a
                    href={trustpilotUrl_Evaluate}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center gap-1 rounded-2xl border border-border/70 bg-surface/90 px-3 text-sm font-semibold leading-none text-primary transition duration-200 hover:border-primary/70 hover:bg-background/95 hover:text-primary"
                  >
                    Opinar sobre nosotros
                    <ArrowUpRight className="size-4" />
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                <span className="text-sm font-semibold text-foreground">Ordenar por</span>
                <Select
                  value={`${sortBy}-${sortDirection}`}
                  onValueChange={(value) => {
                    switch (value) {
                      case "date-newest":
                        setSortBy("date");
                        setSortDirection("newest");
                        break;
                      case "date-oldest":
                        setSortBy("date");
                        setSortDirection("oldest");
                        break;
                      case "rating-highest":
                        setSortBy("rating");
                        setSortDirection("highest");
                        break;
                      case "rating-lowest":
                        setSortBy("rating");
                        setSortDirection("lowest");
                        break;
                    }
                  }}
                >
                  <SelectTrigger className="w-auto max-w-14rem min-w-10rem h-8" />
                  <SelectContent>
                    <SelectItem value="date-newest">Más reciente</SelectItem>
                    <SelectItem value="date-oldest">Más antiguo</SelectItem>
                    <SelectItem value="rating-highest">Mayor puntuación</SelectItem>
                    <SelectItem value="rating-lowest">Menor puntuación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 grid-cols-1">
              {sortedReviews.map((review, index) => (
                <article
                  key={`${review.name}-${index}`}
                  className="group relative overflow-hidden rounded-[2rem] border border-border/60 bg-background/80 p-5 shadow-[0_20px_60px_rgba(10,15,35,0.18)] transition duration-300 hover:-translate-y-1 hover:border-primary/70 hover:bg-background/95"
                  style={{ width: "100%" }}
                >
                  <div className="absolute left-0 top-0 h-2 w-28 rounded-br-full bg-linear-to-r from-primary to-transparent opacity-90" />
                  <div className="absolute left-0 top-0 h-full w-1 bg-linear-to-b from-primary to-transparent opacity-80" />
                  <div className="relative z-10 flex items-center gap-3 text-primary mb-4">
                    {Array.from({ length: review.rating }).map((_, index) => (
                      <Star key={`${review.name}-${index}`} className="size-4 fill-current" />
                    ))}
                  </div>

                  <div className="relative z-10">
                    <h3 className="font-semibold text-foreground text-base leading-tight">{review.title}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{review.date}</p>
                    <div className="h-px w-16 rounded-full bg-primary/20 mb-4" />
                  </div>

                  <div className="relative z-10 flex-1">
                    <p className="text-sm leading-relaxed text-muted-foreground">{review.text}</p>
                  </div>

                  <div className="relative z-10 my-5 h-px w-full bg-linear-to-r from-border/30 via-border/10 to-transparent" />

                  <div className="relative z-10 flex items-center gap-2 text-xs">
                    <span className="font-semibold text-foreground leading-none">{review.name}</span>
                    <span className="h-4 w-px bg-border/20" />
                    <a
                      href={review.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 leading-none text-muted-foreground transition-colors hover:text-primary"
                      aria-label={`Ver reseña de ${review.name}`}
                    >
                      <ShieldCheck className="size-3.5" />
                      Verificado
                    </a>
                    <a
                      href={review.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto inline-flex h-9 items-center gap-1 rounded-2xl border border-border/70 bg-surface/90 px-3 text-sm font-semibold leading-none text-primary transition duration-200 hover:border-primary/70 hover:bg-background/95 hover:text-primary"
                      aria-label={`Abrir opinión de ${review.name}`}
                    >
                      Abrir opinión
                      <ArrowUpRight className="size-3" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

      </div>
      <BrandFooter
        brand={{ ...webDesignConfig, name: "LRG Store Shop" }}
        storeContact={storeShopContact}
      />
    </div>
  );
}
