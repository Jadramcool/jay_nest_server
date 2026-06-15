export interface PaginatedResult<T> {
  list: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    has_next: boolean;
  };
}

export function paginate<T>(
  list: T[],
  pagination: { page: number; pageSize: number; total: number },
): PaginatedResult<T> {
  return {
    list,
    pagination: {
      page: pagination.page,
      page_size: pagination.pageSize,
      total: pagination.total,
      has_next: pagination.page * pagination.pageSize < pagination.total,
    },
  };
}
