import { MarketingPagination } from "@/components/marketing/marketing-pagination";
import { type MarketingPageWindow, buildMarketingPageWindow } from "@/lib/marketing/pagination";
import { cn } from "@auction/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  ariaLabel: string;
  currentPage: number;
  getPageHref?: (page: number) => string;
  totalPages?: number;
  hasMore?: boolean;
  prevHref?: string | null;
  nextHref?: string | null;
  showPageLinks?: boolean;
  className?: string;
  paginationClassName?: string;
  rangeLabel?: ReactNode;
  scroll?: boolean;
};

export function MarketingPaginationControls({
  ariaLabel,
  currentPage,
  getPageHref,
  totalPages,
  hasMore = false,
  prevHref,
  nextHref,
  showPageLinks = true,
  className,
  paginationClassName,
  rangeLabel,
  scroll,
}: Props) {
  const resolvedTotalPages = totalPages ?? (hasMore ? currentPage + 1 : currentPage);
  const resolvedPrevHref =
    prevHref !== undefined
      ? prevHref
      : currentPage <= 1 || !getPageHref
        ? null
        : getPageHref(currentPage - 1);
  const resolvedNextHref =
    nextHref !== undefined
      ? nextHref
      : currentPage >= resolvedTotalPages || !getPageHref
        ? null
        : getPageHref(currentPage + 1);
  const showPagination =
    totalPages != null ? resolvedTotalPages > 1 : Boolean(resolvedPrevHref || resolvedNextHref);

  if (!showPagination && !rangeLabel) {
    return null;
  }

  const pageWindow: MarketingPageWindow =
    showPageLinks && getPageHref
      ? buildMarketingPageWindow({
          currentPage,
          totalPages: resolvedTotalPages,
          getPageHref,
        })
      : { pages: [], showEllipsis: false };

  return (
    <div className={cn(className)}>
      {rangeLabel ? (
        <p className="text-center font-body text-sm text-on-surface-variant">{rangeLabel}</p>
      ) : null}
      <MarketingPagination
        aria-label={ariaLabel}
        className={cn("flex justify-center", paginationClassName)}
        prev={{
          href: resolvedPrevHref,
          label: (
            <>
              <ChevronLeft className="text-sm" aria-hidden />
              Previous
            </>
          ),
        }}
        next={{
          href: resolvedNextHref,
          label: (
            <>
              Next
              <ChevronRight className="text-sm" aria-hidden />
            </>
          ),
        }}
        pages={pageWindow.pages}
        showEllipsis={pageWindow.showEllipsis}
        {...(pageWindow.trailingPage ? { trailingPage: pageWindow.trailingPage } : {})}
        renderLink={({ href, className, children, "aria-current": ariaCurrent }) => (
          <Link
            href={href}
            className={className}
            {...(ariaCurrent ? { "aria-current": ariaCurrent } : {})}
            prefetch={false}
            {...(scroll !== undefined ? { scroll } : {})}
          >
            {children}
          </Link>
        )}
      />
    </div>
  );
}
