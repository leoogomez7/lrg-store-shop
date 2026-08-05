import { cn } from "@/lib/utils";

function getBrandImage(brandSlug?: string) {
  if (brandSlug) {
    if (brandSlug === "store" || brandSlug === "store-shop" || brandSlug === "lrg-store-shop")
      return "/LRG Store Shop PNG.png";
    if (brandSlug === "arcade") return "/LRG Arcade PNG.png";
    if (brandSlug === "web-design") return "/LRG Web Design PNG.png";
    if (brandSlug === "scents") return "/LRG Scents PNG.png";
  }
  if (typeof document === "undefined") return "/LRG Store Shop PNG.png";
  const arcade = document.querySelector(".theme-arcade");
  const scents = document.querySelector(".theme-scents");
  const webdesign = document.querySelector(".theme-webdesign");
  if (arcade) return "/LRG Arcade PNG.png";
  if (scents) return "/LRG Scents PNG.png";
  if (webdesign) return "/LRG Web Design PNG.png";
  return "/LRG Store Shop PNG.png";
}

export function BrandMark({ className, compact = false, label, brandSlug }: { className?: string; compact?: boolean; label?: string; brandSlug?: string }) {
  const src = getBrandImage(brandSlug);

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-xl overflow-hidden">
        <img src={src} alt={label ?? "LRG Store Shop"} className={cn("w-9 h-9 object-contain", compact ? "w-7 h-7" : "w-9 h-9")} />
        <span className="absolute inset-0 rounded-xl bg-foreground/0 transition-colors" />
      </span>
      {!compact && (
        <span className="font-display text-base leading-none font-semibold tracking-tight">
          {label ?? (
            <>
              LRG <span className="text-muted-foreground">Store Shop</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
