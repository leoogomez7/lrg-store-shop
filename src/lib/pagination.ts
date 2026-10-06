export type PaginationItem = number | "ellipsis-left" | "ellipsis-right";

export function getVisiblePaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  const safeCurrentPage = Math.min(Math.max(currentPage, 0), Math.max(totalPages - 1, 0));

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (safeCurrentPage <= 2) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (safeCurrentPage >= totalPages - 3) {
    return [
      1,
      "ellipsis-left",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  const start = safeCurrentPage - 2;
  const end = safeCurrentPage + 3;
  const middlePages = Array.from({ length: end - start + 1 }, (_, index) => start + index);

  return [1, "ellipsis-left", ...middlePages, "ellipsis-right", totalPages];
}
