export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export function clampPagination(page?: number, pageSize?: number): PaginationParams {
  const p = Number.isFinite(page) && page! > 0 ? Math.floor(page!) : DEFAULT_PAGE;
  const size =
    Number.isFinite(pageSize) && pageSize! > 0
      ? Math.min(Math.floor(pageSize!), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return { page: p, pageSize: size };
}
