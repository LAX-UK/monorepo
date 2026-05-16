import { Button } from "@auction/ui";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

export type MarketingLoadMoreProps = {
  /** Items currently shown (accumulated up to current page). */
  shown: number;
  /** Total available items across all pages. */
  total: number;
  /** Current page (1-indexed). */
  page: number;
  pageSize: number;
  /** Base pathname — e.g. `/sales/:slug/:id`. */
  basePath: string;
  /** Query params to preserve when following "Load more" link. */
  preservedQuery?: Array<[string, string]>;
  /** Optional label override ("lots" vs "bidders"). */
  unitLabel?: string;
  /** When true, show underlined "Load all" (maps to `page=all` on the route). */
  showLoadAll?: boolean;
};

function buildNextHref(
  basePath: string,
  nextPage: number,
  preserved: Array<[string, string]> = [],
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of preserved) {
    if (k === "page") continue;
    if (v) qs.set(k, v);
  }
  qs.set("page", String(nextPage));
  return `${basePath}?${qs.toString()}`;
}

function buildLoadAllHref(basePath: string, preserved: Array<[string, string]> = []): string {
  const qs = new URLSearchParams();
  for (const [k, v] of preserved) {
    if (k === "page") continue;
    if (v) qs.set(k, v);
  }
  qs.set("page", "all");
  return `${basePath}?${qs.toString()}`;
}

/** Progress + next-page link pattern for marketing catalogues (saleroom lots, etc.). */
export function MarketingLoadMore({
  shown,
  total,
  page,
  pageSize,
  basePath,
  preservedQuery,
  unitLabel = "lots",
  showLoadAll = false,
}: MarketingLoadMoreProps) {
  const hasMore = shown < total;
  const nextPage = page + 1;
  const percent = total === 0 ? 0 : Math.min(100, Math.round((shown / total) * 100));
  const nextHref = buildNextHref(basePath, nextPage, preservedQuery);
  const loadAllHref = buildLoadAllHref(basePath, preservedQuery);
  const remaining = Math.min(pageSize, Math.max(0, total - shown));
  const canLoadAll = showLoadAll && total > 0;

  return (
    <div className="mx-auto flex w-full max-w-[233px] flex-col items-stretch gap-4 py-10 text-center">
      <p className="text-center text-xs leading-4 text-on-surface-variant">
        Showing {shown}/{total}
        <span className="sr-only">
          {" "}
          {percent}% of {unitLabel} loaded
        </span>
      </p>
      <div
        className="relative h-[5px] w-full overflow-hidden bg-surface-container-high"
        aria-hidden
      >
        <div
          className="h-full bg-on-surface transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {hasMore ? (
        <div className="flex justify-center">
          <Button
            asChild
            variant="ghost"
            className="h-10 w-[148px] min-w-0 border border-outline-variant/50 bg-transparent font-body text-base font-semibold leading-6 tracking-wide text-on-surface hover:bg-transparent dark:hover:bg-transparent"
          >
            <Link
              href={nextHref}
              rel="next"
              prefetch={false}
              className="inline-flex items-center justify-center"
            >
              Load More
              <ChevronDown className="ml-1 size-4" aria-hidden />
              <span className="sr-only">
                — next {remaining} {unitLabel}
              </span>
            </Link>
          </Button>
        </div>
      ) : null}
      {canLoadAll && hasMore ? (
        <div className="flex justify-center">
          <Link
            href={loadAllHref}
            className="inline-block w-[148px] text-center font-body text-base font-normal leading-6 tracking-wide text-on-surface underline decoration-on-surface underline-offset-2"
          >
            Load all
          </Link>
        </div>
      ) : null}
    </div>
  );
}
