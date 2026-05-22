"use client";

import {
  type CalendarSalesUrlState,
  calendarSalesHrefFromState,
} from "@/lib/marketing/sales-calendar-params";
import { MarketingPagination } from "@auction/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  state: CalendarSalesUrlState;
  page: number;
  hasMore: boolean;
};

function buildPageHref(state: CalendarSalesUrlState, pageNum: number): string {
  return calendarSalesHrefFromState(state, pageNum <= 1 ? { page: undefined } : { page: pageNum });
}

export function SalesCalendarPagination({ state, page, hasMore }: Props) {
  if (page <= 1 && !hasMore) {
    return null;
  }

  const prev = Math.max(1, page - 1);
  const next = page + 1;
  const totalPages = hasMore ? page + 1 : page;

  const windowStart = Math.max(1, page - 1);
  const windowEnd = Math.min(totalPages, page + 1);
  const pages: { page: number; href: string; current?: boolean }[] = [];
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push({ page: p, href: buildPageHref(state, p), current: p === page });
  }

  const showEllipsis = totalPages > windowEnd;
  const trailingPage =
    showEllipsis && totalPages > windowEnd
      ? { page: totalPages, href: buildPageHref(state, totalPages) }
      : null;

  return (
    <div className="mx-auto mt-10 flex max-w-screen-2xl justify-center border-t border-border-hairline pt-10">
      <MarketingPagination
        aria-label="Sales calendar pagination"
        prev={{
          href: page <= 1 ? null : buildPageHref(state, prev),
          label: (
            <>
              <ChevronLeft className="text-sm" aria-hidden />
              Previous
            </>
          ),
        }}
        next={{
          href: hasMore ? buildPageHref(state, next) : null,
          label: (
            <>
              Next
              <ChevronRight className="text-sm" aria-hidden />
            </>
          ),
        }}
        pages={pages}
        showEllipsis={showEllipsis}
        {...(trailingPage ? { trailingPage } : {})}
        renderLink={({ href, className, children, "aria-current": ariaCurrent }) => (
          <Link href={href} className={className} aria-current={ariaCurrent} prefetch={false}>
            {children}
          </Link>
        )}
      />
    </div>
  );
}
