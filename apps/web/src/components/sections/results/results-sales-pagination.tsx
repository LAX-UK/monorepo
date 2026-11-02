"use client";

import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
import { resultsHref } from "@/lib/marketing/results-page-params";

export function ResultsSalesPagination({ page, hasMore }: { page: number; hasMore: boolean }) {
  return (
    <MarketingPaginationControls
      ariaLabel="Results pagination"
      currentPage={page}
      hasMore={hasMore}
      getPageHref={(pageNum) => resultsHref("sales", pageNum)}
      className={`${MARKETING_PAGE_INNER} mt-12 flex justify-center border-t border-border-hairline pt-10`}
    />
  );
}
