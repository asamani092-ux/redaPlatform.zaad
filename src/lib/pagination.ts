/** حجم الصفحة الافتراضي للقوائم التشغيلية — يخفّف ضغط قاعدة البيانات */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export type PageParams = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = PageMeta & { data: T };

/**
 * قراءة page/pageSize من Query — O(1).
 * page يبدأ من 1، pageSize افتراضي 50 وبحد أقصى 100.
 */
export function parsePageParams(
  searchParams: URLSearchParams,
  defaults?: { pageSize?: number; maxPageSize?: number },
): PageParams {
  const defaultSize = defaults?.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxSize = defaults?.maxPageSize ?? MAX_PAGE_SIZE;
  const rawPage = Number(searchParams.get("page") ?? "1");
  const rawSize = Number(searchParams.get("pageSize") ?? String(defaultSize));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize = Number.isFinite(rawSize)
    ? Math.min(maxSize, Math.max(1, Math.floor(rawSize)))
    : defaultSize;
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPageMeta(page: number, pageSize: number, total: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  return {
    page: Math.min(page, totalPages),
    pageSize,
    total,
    totalPages,
  };
}

/** دمج البيانات مع بيانات التصفح — O(1) */
export function paginatedPayload<T>(
  data: T,
  page: number,
  pageSize: number,
  total: number,
): Paginated<T> {
  return {
    data,
    ...buildPageMeta(page, pageSize, total),
  };
}
