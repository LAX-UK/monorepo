import { Button } from "./button.js";

export type PaginationFooterProps = {
  offset: number;
  limit: number;
  /** When set, append “of {total}” to the range label. */
  total?: number;
  /** Rows on this page (defaults to `limit`). Use actual `rows.length` when total is unknown. */
  countOnPage?: number;
  /** Build href for the previous/next page (server components pass absolute path + search). */
  prevHref?: string | null;
  nextHref?: string | null;
};

export function PaginationFooter({
  offset,
  limit,
  total,
  countOnPage,
  prevHref,
  nextHref,
}: PaginationFooterProps) {
  const n = countOnPage ?? limit;
  const start = n === 0 ? 0 : offset + 1;
  const end = total !== undefined ? Math.min(offset + n, total) : offset + n;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-4 text-sm text-on-surface-variant">
      <span>
        {total !== undefined ? (
          <>
            Showing {start}–{end} of {total}
          </>
        ) : (
          <>
            Showing {start}–{end}
          </>
        )}
      </span>
      <div className="flex gap-2">
        {prevHref ? (
          <Button variant="outline" size="sm" asChild>
            <a href={prevHref}>Previous</a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
        )}
        {nextHref ? (
          <Button variant="outline" size="sm" asChild>
            <a href={nextHref}>Next</a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
