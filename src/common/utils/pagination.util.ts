export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginate<T>(
  items: T[],
  pagination: { page: number; pageSize: number; total: number },
): PaginatedResult<T> {
  return {
    items,
    total: pagination.total,
    page: pagination.page,
    pageSize: pagination.pageSize,
  };
}
