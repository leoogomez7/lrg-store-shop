import type { ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const style = {
    transitionDelay: `${delay}s`,
    transitionProperty: "transform, opacity",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDuration: "600ms",
    transform: `translateY(${y}px)`,
    opacity: 0,
  };

  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        opacity: 1,
        transform: "translateY(0)",
        filter: "blur(0px)",
        transition: "opacity 450ms cubic-bezier(0.22, 1, 0.36, 1), transform 450ms cubic-bezier(0.22, 1, 0.36, 1), filter 450ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {children}
    </div>
  );
}
