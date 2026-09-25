import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function getBrandImage(brandSlug?: string) {
  if (brandSlug) {
    if (brandSlug === "store" || brandSlug === "store-shop" || brandSlug === "lrg-store-shop")
      return "/LRG Store Shop PNG.png";
    if (brandSlug === "arcade") return "/LRG Arcade PNG.png";
    if (brandSlug === "web-design") return "/LRG Web Design PNG.png";
    if (brandSlug === "scents") return "/LRG Scents PNG.png";
  }
  return "/LRG Store Shop PNG.png";
}

export function BrandMark({
  className,
  compact = false,
  label,
  brandSlug,
}: {
  className?: string;
  compact?: boolean;
  label?: string;
  brandSlug?: string;
}) {
  const [resolvedSrc, setResolvedSrc] = useState(() => getBrandImage(brandSlug));

  useEffect(() => {
    const nextSrc = getBrandImage(brandSlug);

    if (typeof document === "undefined") {
      setResolvedSrc(nextSrc);
      return;
    }

    const arcade = document.querySelector(".theme-arcade");
    const scents = document.querySelector(".theme-scents");
    const webdesign = document.querySelector(".theme-webdesign");

    const resolved = arcade
      ? "/LRG Arcade PNG.png"
      : scents
        ? "/LRG Scents PNG.png"
        : webdesign
          ? "/LRG Web Design PNG.png"
          : nextSrc;

    setResolvedSrc(resolved);
  }, [brandSlug]);

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-xl overflow-hidden">
        <img
          src={resolvedSrc}
          alt={label ?? "LRG Store Shop"}
          className={cn(
            "w-9 h-9 object-contain",
            compact ? "w-7 h-7" : "w-9 h-9",
            brandSlug === "scents" && "scale-[1.35]",
          )}
        />
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
