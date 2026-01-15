import { useState, useMemo } from "react";

interface UsePaginationOptions {
  pageSize?: number;
}

interface UsePaginationResult<T> {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  paginatedData: T[];
  setCurrentPage: (page: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
  startIndex: number;
  endIndex: number;
}

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationResult<T> {
  const { pageSize = 25 } = options;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Reset to page 1 if data changes and current page is out of bounds
  const safePage = Math.min(currentPage, totalPages);
  if (safePage !== currentPage) {
    setCurrentPage(safePage);
  }

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;
    return data.slice(start, end);
  }, [data, safePage, pageSize]);

  const startIndex = (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, data.length);

  return {
    currentPage: safePage,
    totalPages,
    pageSize,
    paginatedData,
    setCurrentPage: (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages))),
    goToFirstPage: () => setCurrentPage(1),
    goToLastPage: () => setCurrentPage(totalPages),
    goToNextPage: () => setCurrentPage((prev) => Math.min(prev + 1, totalPages)),
    goToPreviousPage: () => setCurrentPage((prev) => Math.max(prev - 1, 1)),
    canGoNext: safePage < totalPages,
    canGoPrevious: safePage > 1,
    startIndex: data.length > 0 ? startIndex : 0,
    endIndex,
  };
}
