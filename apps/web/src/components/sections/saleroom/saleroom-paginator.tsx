import { Button } from "@auction/ui/components/button";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

type Props = {
  /** Lots currently shown (accumulated up to current page). */
  shown: number;
  /** Total available lots across all pages. */
  total: number;
  /** Current page (1-indexed). */
  page: number;
  pageSize: number;
  /** Base pathname — e.g. `/sales/:id`. */
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

/**
 * Figma: narrow column, flat progress, Load more, optional Load all.
 */
export function SaleroomPaginator({
  shown,
  total,
  page,
  pageSize,
  basePath,
  preservedQuery,
  unitLabel = "lots",
  showLoadAll = false,
}: Props) {
  const hasMore = shown < total;
  const nextPage = page + 1;
  const percent = total === 0 ? 0 : Math.min(100, Math.round((shown / total) * 100));
  const nextHref = buildNextHref(basePath, nextPage, preservedQuery);
  const loadAllHref = buildLoadAllHref(basePath, preservedQuery);
  const remaining = Math.min(pageSize, Math.max(0, total - shown));
  const canLoadAll = showLoadAll && total > 0;

  return (
    <div className="mx-auto flex w-full max-w-[233px] flex-col items-stretch gap-4 py-10 text-center">
      <p className="text-center text-xs leading-4 text-[#474747]">
        Showing {shown}/{total}
        <span className="sr-only">
          {" "}
          {percent}% of {unitLabel} loaded
        </span>
      </p>
      <div className="relative h-[5px] w-full overflow-hidden bg-[#D1D1D1]" aria-hidden>
        <div
          className="h-full bg-[#050505] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {hasMore ? (
        <Button
          asChild
          variant="ghost"
          className="h-10 w-full min-w-0 border border-[#A3A3A3] bg-transparent font-['DM_Sans',sans-serif] text-base font-semibold leading-6 tracking-[0.8px] text-[#0A0A0A] hover:bg-transparent"
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
      ) : null}
      {canLoadAll && hasMore ? (
        <Link
          href={loadAllHref}
          className="text-center font-['DM_Sans',sans-serif] text-base font-normal leading-6 tracking-[0.8px] text-[#050505] underline decoration-[#050505] underline-offset-2"
        >
          Load all
        </Link>
      ) : null}
    </div>
  );
}
