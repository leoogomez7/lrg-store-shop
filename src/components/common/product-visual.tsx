import { cn } from "@/lib/utils";

const patterns = ["grid", "rings", "waves"] as const;

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total + value.charCodeAt(index) * (index + 7)) % 997;
  }
  return total;
}

/**
 * Visual de producto generado a partir del identificador.
 * Un único componente para todas las marcas: cambia con los tokens del tema.
 */
export function ProductVisual({
  seed,
  label,
  className,
}: {
  seed: string;
  label: string;
  className?: string;
}) {
  const value = hash(seed);
  const pattern = patterns[value % patterns.length];
  const angle = 90 + (value % 180);
  const initials = label
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (
    <div
      className={cn("relative overflow-hidden rounded-[inherit] bg-surface-2", className)}
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage: `linear-gradient(${angle}deg, var(--brand) 0%, var(--brand-2) 100%)`,
        }}
      />
      <div className="absolute inset-0 mix-blend-soft-light opacity-70">
        {pattern === "grid" && (
          <div
            className="size-full"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.28) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
        )}
        {pattern === "rings" && (
          <div
            className="size-full"
            style={{
              backgroundImage:
                "repeating-radial-gradient(circle at 30% 110%, rgba(255,255,255,.32) 0 2px, transparent 2px 22px)",
            }}
          />
        )}
        {pattern === "waves" && (
          <div
            className="size-full"
            style={{
              backgroundImage:
                "repeating-linear-gradient(115deg, rgba(255,255,255,.26) 0 2px, transparent 2px 18px)",
            }}
          />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
      <span className="font-display absolute bottom-3 left-4 text-3xl font-bold text-foreground/85 tracking-tight">
        {initials || "LRG"}
      </span>
    </div>
  );
}
