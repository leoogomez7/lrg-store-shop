import * as React from "react";

import { cn } from "@/lib/utils";

type TableProps = React.HTMLAttributes<HTMLTableElement> & {
  containerClassName?: string;
};

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const scrollbarRef = React.useRef<HTMLDivElement | null>(null);
    const [scrollbarState, setScrollbarState] = React.useState<{
      visible: boolean;
      left: number;
      width: number;
      scrollWidth: number;
    }>({ visible: false, left: 0, width: 0, scrollWidth: 0 });

    const updateScrollbar = React.useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const scrollWidth = container.scrollWidth;
      const isInViewport = rect.bottom > 0 && rect.top < window.innerHeight;
      const hasHorizontalOverflow = scrollWidth > container.clientWidth + 1;

      setScrollbarState({
        visible: isInViewport && hasHorizontalOverflow,
        left: Math.max(0, rect.left),
        width: Math.min(window.innerWidth, Math.max(0, rect.width)),
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
      window.addEventListener("scroll", handleWindowChange, { passive: true });
      window.addEventListener("resize", handleWindowChange);
      const observer = new ResizeObserver(handleWindowChange);
      observer.observe(container);
      updateScrollbar();

      return () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("scroll", handleWindowChange);
        window.removeEventListener("resize", handleWindowChange);
        observer.disconnect();
      };
    }, [updateScrollbar]);

    return (
      <>
        <div
          ref={containerRef}
          className={cn(
            "relative w-full overflow-x-auto overflow-y-visible rounded-2xl border border-border/60 bg-muted/20 backdrop-blur-sm",
            containerClassName,
          )}
        >
          <table
            ref={ref}
            className={cn("w-full caption-bottom text-sm text-foreground", className)}
            {...props}
          />
        </div>
        {scrollbarState.visible && (
          <div
            ref={scrollbarRef}
            className="fixed bottom-2 z-50 overflow-x-auto rounded-full border border-border/70 bg-background/95 shadow-lg backdrop-blur"
            style={{ left: scrollbarState.left, width: scrollbarState.width }}
            onScroll={(event) => {
              const container = containerRef.current;
              if (container) container.scrollLeft = event.currentTarget.scrollLeft;
            }}
            aria-label="Desplazamiento horizontal de la tabla"
          >
            <div style={{ width: scrollbarState.scrollWidth, height: 1 }} />
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
      "h-12 px-3 text-left align-middle text-sm font-medium text-foreground/90 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
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
      "p-3 align-middle text-sm text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
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
