import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";

export type SearchPaginationBarProps = {
  offset: number;
  pageSize: number;
  resultCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  prevHref: string;
  nextHref: string;
  /** Exact number of matching lots; enables numbered pages + precise range copy. */
  totalCount?: number | null;
  /** Offset-based href builder for numbered pages (page is 1-based). */
  getPageHref?: (page: number) => string;
};

export function SearchPaginationBar({
  offset,
  pageSize,
  resultCount,
  hasNext,
  hasPrev,
  prevHref,
  nextHref,
  totalCount = null,
  getPageHref,
}: SearchPaginationBarProps) {
  const start = resultCount === 0 ? 0 : offset + 1;
  const end = offset + resultCount;
  const currentPage = Math.floor(offset / pageSize) + 1;
  const hasExactTotal = totalCount != null && getPageHref != null;

  if (hasExactTotal) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    return (
      <MarketingPaginationControls
        ariaLabel="Search results pagination"
        currentPage={currentPage}
        totalPages={totalPages}
        getPageHref={getPageHref}
        className={`${MARKETING_PAGE_INNER} mt-12 space-y-6 border-t border-border-hairline pt-10`}
        scroll={false}
        rangeLabel={
          totalCount === 0 ? (
            "No lots match"
          ) : (
            <>
              Showing{" "}
              <span className="font-medium tabular-nums text-on-surface">
                {start}–{Math.min(end, totalCount)}
              </span>{" "}
              of <span className="font-medium tabular-nums text-on-surface">{totalCount}</span>
            </>
          )
        }
      />
    );
  }

  const approxSuffix = hasNext ? "+" : "";

  return (
    <MarketingPaginationControls
      ariaLabel="Search results pagination"
      currentPage={currentPage}
      prevHref={hasPrev ? prevHref : null}
      nextHref={hasNext ? nextHref : null}
      showPageLinks={false}
      className={`${MARKETING_PAGE_INNER} mt-12 space-y-6 border-t border-border-hairline pt-10`}
      scroll={false}
      rangeLabel={
        resultCount === 0 ? (
          "No lots on this page"
        ) : (
          <>
            Showing{" "}
            <span className="font-medium tabular-nums text-on-surface">
              {start}–{end}
            </span>{" "}
            {approxSuffix ? (
              <>
                of approximately{" "}
                <span className="font-medium tabular-nums text-on-surface">{end}+</span>
              </>
            ) : (
              <>
                of <span className="font-medium tabular-nums text-on-surface">{end}</span>
              </>
            )}
          </>
        )
      }
    />
  );
}
