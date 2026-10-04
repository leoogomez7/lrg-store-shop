export const scrollToTopOnFirstSelection = (
  selectedCount: number,
  isSelecting: boolean,
) => {
  if (typeof window === "undefined" || selectedCount > 0 || !isSelecting) return;

  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  });
};
