import { Button } from "@auction/ui/components/button";
import { Progress } from "@auction/ui/components/progress";
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

/**
 * Server-pagination friendly "Load more" control.
 * Uses shadcn `Progress` for the completion bar and `Button asChild`
 * with a `<Link rel="next">` so crawlers can follow paging without
 * any client JS. No "Load all" (performance + SEO + security).
 */
export function SaleroomPaginator({
  shown,
  total,
  page,
  pageSize,
  basePath,
  preservedQuery,
  unitLabel = "lots",
}: Props) {
  const hasMore = shown < total;
  const nextPage = page + 1;
  const percent = total === 0 ? 0 : Math.min(100, Math.round((shown / total) * 100));
  const nextHref = buildNextHref(basePath, nextPage, preservedQuery);
  const remaining = Math.min(pageSize, Math.max(0, total - shown));

  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
        Showing {shown} of {total} {unitLabel}
      </p>
      <Progress
        value={percent}
        className="h-1 w-full max-w-xl bg-surface-container-high"
        aria-label={`${percent}% of ${unitLabel} loaded`}
      />
      {hasMore ? (
        <Button
          asChild
          variant="outline"
          className="min-h-11 rounded-full border-outline-variant/60 bg-surface-container-low px-6 py-2.5 font-label text-xs font-bold uppercase tracking-widest text-on-surface hover:border-primary hover:text-primary"
        >
          <Link href={nextHref} rel="next" prefetch={false}>
            Load more
            <ChevronDown className="size-4" aria-hidden />
            <span className="sr-only">— next {remaining} items</span>
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
