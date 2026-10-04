export const scrollToTopOnFirstSelection = (
  selectedCount: number,
  isSelecting: boolean,
  hasScrolledRef: { current: boolean },
) => {
  if (
    typeof window === "undefined" ||
    selectedCount > 0 ||
    !isSelecting ||
    hasScrolledRef.current
  ) {
    return;
  }

  hasScrolledRef.current = true;
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  });
};
