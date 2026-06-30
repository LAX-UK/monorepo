"use client";

import { Button } from "@auction/ui/components/button";

type Props = {
  offset: number;
  countOnPage: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  pending?: boolean;
};

function rangeLabel(offset: number, countOnPage: number, total: number): string {
  const start = countOnPage === 0 ? 0 : offset + 1;
  const end = Math.min(offset + countOnPage, total);
  return `Showing ${start}–${end} of ${total}`;
}

/** Presentational admin list pagination — caller wires nuqs or other URL state. */
export function AdminListNuqsPagination({
  offset,
  countOnPage,
  total,
  onPrev,
  onNext,
  pending = false,
}: Props) {
  const hasPrev = offset > 0;
  const hasNext = offset + countOnPage < total;
  const range = rangeLabel(offset, countOnPage, total);

  return (
    <>
      {hasPrev || hasNext ? (
        <div className="mt-6 space-y-3 lg:hidden">
          <p className="font-body text-sm text-on-surface-variant" aria-live="polite">
            {range}
          </p>
          <div className="flex flex-col gap-2">
            {hasPrev ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 w-full max-w-sm"
                disabled={pending}
                onClick={onPrev}
                aria-label="Previous page"
              >
                Previous
              </Button>
            ) : null}
            {hasNext ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 w-full max-w-sm"
                disabled={pending}
                onClick={onNext}
                aria-label="Next page"
              >
                Next page
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-6 hidden lg:block">
        <nav aria-label="Pagination">
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-4 text-sm text-on-surface-variant">
            <span>{range}</span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasPrev || pending}
                onClick={onPrev}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext || pending}
                onClick={onNext}
              >
                Next
              </Button>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
