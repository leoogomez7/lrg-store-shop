import { cn } from "@/lib/utils";

export function BrandMark({ className, compact = false, label }: { className?: string; compact?: boolean; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="gradient-brand relative grid size-9 place-items-center rounded-xl">
        <span className="font-display text-sm font-bold text-primary-foreground">LRG</span>
        <span className="absolute inset-0 rounded-xl bg-foreground/0 transition-colors" />
      </span>
      {!compact && (
        <span className="font-display text-base leading-none font-semibold tracking-tight">
          {label ?? (
            <>
              Store<span className="text-muted-foreground"> Shop</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}
