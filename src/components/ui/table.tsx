import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string;
  hideScrollbarOnMobile?: boolean;
  hideScrollbar?: boolean;
  selectionGutter?: boolean;
};

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      containerClassName,
      hideScrollbarOnMobile = false,
      hideScrollbar = false,
      selectionGutter = false,
      ...props
    },
    ref,
  ) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const scrollbarRef = React.useRef<HTMLDivElement | null>(null);
    const [scrollbarState, setScrollbarState] = React.useState<{
      visible: boolean;
      width: number;
      scrollWidth: number;
    }>({ visible: false, width: 0, scrollWidth: 0 });

    const updateScrollbar = React.useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      const scrollWidth = container.scrollWidth;
      const hasHorizontalOverflow = scrollWidth > container.clientWidth + 1;

      setScrollbarState({
        visible: hasHorizontalOverflow,
        width: container.clientWidth,
        scrollWidth,
      });
    }, []);

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleScroll = () => {
        if (scrollbarRef.current) scrollbarRef.current.scrollLeft = container.scrollLeft;
        updateScrollbar();
      };
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
            className={cn("w-full caption-bottom text-sm text-foreground", className)}
            {...props}
          />
        </div>
        {scrollbarState.visible && !hideScrollbar && (
          <div
            className={cn(
              "mt-2 flex w-full items-center gap-1 rounded-full border border-border/70 bg-background/95 p-1 shadow-lg backdrop-blur",
              hideScrollbarOnMobile && "max-lg:hidden",
            )}
            style={{ width: scrollbarState.width }}
            aria-label="Controles de desplazamiento horizontal de la tabla"
          >
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-full border border-border/70 text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                const container = containerRef.current;
                if (!container) return;
                container.scrollBy({ left: -container.clientWidth * 0.95, behavior: "smooth" });
              }}
              aria-label="Desplazar tabla hacia la izquierda"
              title="Desplazar hacia la izquierda"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div
              ref={scrollbarRef}
              className="min-w-0 flex-1 overflow-x-auto rounded-full"
              onScroll={(event) => {
                const container = containerRef.current;
                if (container) container.scrollLeft = event.currentTarget.scrollLeft;
              }}
              aria-label="Barra de desplazamiento horizontal de la tabla"
            >
              <div className="h-1.25" style={{ width: scrollbarState.scrollWidth }} />
            </div>
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-full border border-border/70 text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                const container = containerRef.current;
                if (!container) return;
                container.scrollBy({ left: container.clientWidth * 0.95, behavior: "smooth" });
              }}
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
      "h-10 px-2.5 text-left align-middle text-sm font-medium text-foreground/90 has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
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
