"use client";

import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
import {
  type CalendarSalesUrlState,
  calendarSalesHrefFromState,
} from "@/lib/marketing/sales-calendar-params";

type Props = {
  state: CalendarSalesUrlState;
  page: number;
  hasMore: boolean;
};

function buildPageHref(state: CalendarSalesUrlState, pageNum: number): string {
  return calendarSalesHrefFromState(state, pageNum <= 1 ? { page: undefined } : { page: pageNum });
}

export function SalesCalendarPagination({ state, page, hasMore }: Props) {
  return (
    <MarketingPaginationControls
      ariaLabel="Sales calendar pagination"
      currentPage={page}
      hasMore={hasMore}
      getPageHref={(pageNum) => buildPageHref(state, pageNum)}
      className={`${MARKETING_PAGE_INNER} mt-10 flex justify-center border-t border-border-hairline pt-10`}
    />
  );
}
