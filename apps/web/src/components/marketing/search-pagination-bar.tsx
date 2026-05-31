import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";

export type SearchPaginationBarProps = {
  offset: number;
  pageSize: number;
  resultCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  prevHref: string;
  nextHref: string;
};

export function SearchPaginationBar({
  offset,
  pageSize,
  resultCount,
  hasNext,
  hasPrev,
  prevHref,
  nextHref,
}: SearchPaginationBarProps) {
  const start = resultCount === 0 ? 0 : offset + 1;
  const end = offset + resultCount;
  const approxSuffix = hasNext ? "+" : "";
  const currentPage = Math.floor(offset / pageSize) + 1;

  return (
    <MarketingPaginationControls
      ariaLabel="Search results pagination"
      currentPage={currentPage}
      prevHref={hasPrev ? prevHref : null}
      nextHref={hasNext ? nextHref : null}
      showPageLinks={false}
      className="mt-12 space-y-6 border-t border-border-hairline pt-10"
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
