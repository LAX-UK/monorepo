import type { MarketingPaginationPage } from "@/components/marketing/marketing-pagination";

export type HasMorePage<T> = {
  items: T[];
  hasMore: boolean;
};

export type MarketingPageWindow = {
  pages: MarketingPaginationPage[];
  trailingPage?: { page: number; href: string };
  showEllipsis: boolean;
};

export function deriveHasMorePage<T>(rows: readonly T[], pageSize: number): HasMorePage<T> {
  const hasMore = rows.length > pageSize;
  return {
    items: rows.slice(0, pageSize),
    hasMore,
  };
}

export function buildMarketingPageWindow({
  currentPage,
  totalPages,
  getPageHref,
}: {
  currentPage: number;
  totalPages: number;
  getPageHref: (page: number) => string;
}): MarketingPageWindow {
  const windowStart = Math.max(1, currentPage - 1);
  const windowEnd = Math.min(totalPages, currentPage + 1);
  const pages: MarketingPaginationPage[] = [];

  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push({ page: p, href: getPageHref(p), current: p === currentPage });
  }

  const showEllipsis = totalPages > windowEnd;
  const trailingPage =
    showEllipsis && totalPages > windowEnd
      ? { page: totalPages, href: getPageHref(totalPages) }
      : undefined;

  return {
    pages,
    ...(trailingPage ? { trailingPage } : {}),
    showEllipsis,
  };
}
