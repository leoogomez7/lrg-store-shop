import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string;
  hideScrollbarOnMobile?: boolean;
  hideScrollbar?: boolean;
  alwaysShowScrollbarOnDesktop?: boolean;
  stickyHeader?: boolean;
  stickyScrollbar?: boolean;
  selectionGutter?: boolean;
};

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      containerClassName,
      hideScrollbarOnMobile = false,
      hideScrollbar = false,
      alwaysShowScrollbarOnDesktop = false,
      stickyHeader = false,
      stickyScrollbar = false,
      selectionGutter = false,
      ...props
    },
    ref,
  ) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const scrollbarTrackRef = React.useRef<HTMLDivElement | null>(null);
    const [stickyHeaderOffset, setStickyHeaderOffset] = React.useState(0);
    const [scrollbarState, setScrollbarState] = React.useState<{
      visible: boolean;
      width: number;
      scrollWidth: number;
      scrollLeft: number;
      maxScrollLeft: number;
    }>({ visible: false, width: 0, scrollWidth: 0, scrollLeft: 0, maxScrollLeft: 0 });

    const updateScrollbar = React.useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      const scrollWidth = container.scrollWidth;
      const maxScrollLeft = Math.max(scrollWidth - container.clientWidth, 0);
      const hasHorizontalOverflow = scrollWidth > container.clientWidth + 1;

      setScrollbarState({
        visible: hasHorizontalOverflow,
        width: container.clientWidth,
        scrollWidth,
        scrollLeft: container.scrollLeft,
        maxScrollLeft,
      });
    }, []);

    const scrollByAmount = React.useCallback((direction: 1 | -1) => {
      const container = containerRef.current;
      if (!container) return;

      const step = Math.max(container.clientWidth * 0.35, 120);
      container.scrollTo({
        left: container.scrollLeft + direction * step,
        behavior: "smooth",
      });
    }, []);

    const handleTrackPointer = React.useCallback((clientX: number) => {
      const container = containerRef.current;
      const track = scrollbarTrackRef.current;
      if (!container || !track) return;

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const nextScrollLeft = ratio * scrollbarState.maxScrollLeft;
      container.scrollTo({ left: nextScrollLeft, behavior: "auto" });
      updateScrollbar();
    }, [scrollbarState.maxScrollLeft, updateScrollbar]);

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleScroll = () => updateScrollbar();
      const handleWindowChange = () => updateScrollbar();

      container.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleWindowChange);
      const observer = new ResizeObserver(handleWindowChange);
      observer.observe(container);
      updateScrollbar();

      return () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleWindowChange);
        observer.disconnect();
      };
    }, [updateScrollbar]);

    React.useEffect(() => {
      if (!stickyHeader) return;

      const updateStickyHeader = () => {
        const container = containerRef.current;
        const table = container?.querySelector("table");
        const header = table?.tHead;
        if (!table || !header) return;

        const tableRect = table.getBoundingClientRect();
        const headerHeight = header.getBoundingClientRect().height;
        const maxOffset = Math.max(tableRect.height - headerHeight, 0);
        const nextOffset = Math.min(Math.max(-tableRect.top, 0), maxOffset);
        setStickyHeaderOffset((current) =>
          Math.abs(current - nextOffset) > 0.5 ? nextOffset : current,
        );
      };

      window.addEventListener("scroll", updateStickyHeader, { passive: true });
      window.addEventListener("resize", updateStickyHeader);
      const observer = new ResizeObserver(updateStickyHeader);
      const table = containerRef.current?.querySelector("table");
      if (table) observer.observe(table);
      updateStickyHeader();

      return () => {
        window.removeEventListener("scroll", updateStickyHeader);
        window.removeEventListener("resize", updateStickyHeader);
        observer.disconnect();
      };
    }, [stickyHeader]);

    const thumbWidth =
      scrollbarState.maxScrollLeft <= 0 || scrollbarState.width <= 0
        ? 100
        : (scrollbarState.width / (scrollbarState.scrollWidth || scrollbarState.width)) * 100;
    const thumbLeft =
      scrollbarState.maxScrollLeft <= 0
        ? 0
        : (scrollbarState.scrollLeft / scrollbarState.maxScrollLeft) * (100 - thumbWidth);

    return (
      <>
        <div
          ref={containerRef}
          className={cn(
            "relative w-full overflow-x-auto overflow-y-visible rounded-2xl border border-border/60 bg-muted/20 backdrop-blur-sm scrollbar-none [&::-webkit-scrollbar]:hidden",
            selectionGutter && "pl-8",
            containerClassName,
          )}
        >
          <table
            ref={ref}
            className={cn(
              "w-full caption-bottom text-sm text-foreground",
              stickyHeader && "table-sticky-header",
              className,
            )}
            style={
              stickyHeader
                ? ({ "--table-sticky-header-offset": `${stickyHeaderOffset}px` } as React.CSSProperties)
                : undefined
            }
            {...props}
          />
        </div>
        {!hideScrollbar &&
          (scrollbarState.visible || (alwaysShowScrollbarOnDesktop && !hideScrollbarOnMobile)) && (
          <div
            className={cn(
              "mt-2 flex w-full items-center gap-1 rounded-full border border-border/70 bg-background/95 p-1 shadow-[0_8px_18px_rgba(0,0,0,0.08)] backdrop-blur",
              stickyScrollbar && "sticky bottom-0 z-20",
              hideScrollbarOnMobile && "max-md:hidden",
            )}
            style={{ width: scrollbarState.width }}
            aria-label="Controles de desplazamiento horizontal de la tabla"
          >
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-full border border-border/70 text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => scrollByAmount(-1)}
              aria-label="Desplazar tabla hacia la izquierda"
              title="Desplazar hacia la izquierda"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div
              ref={scrollbarTrackRef}
              className="relative h-2.5 min-w-0 flex-1 cursor-default touch-none select-none overflow-hidden rounded-full border border-border/60 bg-muted/80"
              onPointerDown={(event) => {
                handleTrackPointer(event.clientX);

                const handleMove = (moveEvent: PointerEvent) => handleTrackPointer(moveEvent.clientX);
                const handleUp = () => {
                  window.removeEventListener("pointermove", handleMove);
                  window.removeEventListener("pointerup", handleUp);
                };

                window.addEventListener("pointermove", handleMove);
                window.addEventListener("pointerup", handleUp);
              }}
              aria-label="Barra de desplazamiento horizontal de la tabla"
            >
              <div
                className="absolute inset-y-0 rounded-full bg-foreground/40 transition-[left,width] duration-150"
                style={{
                  width: `${Math.max(thumbWidth, 18)}%`,
                  left: `${thumbLeft}%`,
                }}
              />
            </div>
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-full border border-border/70 text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => scrollByAmount(1)}
              aria-label="Desplazar tabla hacia la derecha"
              title="Desplazar hacia la derecha"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </>
    );
  },
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "bg-surface-2 text-foreground [&_tr]:border-b [&_tr]:border-border/60",
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b border-border/60 transition-colors hover:bg-surface-2/80 data-[state=selected]:bg-surface-2",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 whitespace-nowrap px-2.5 text-left align-middle text-sm font-medium text-foreground/90 has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-2.5 py-2 align-middle text-sm text-foreground has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
));
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
