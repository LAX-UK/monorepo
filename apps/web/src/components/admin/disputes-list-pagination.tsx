"use client";

import { useDisputesListNuqs } from "@/lib/admin/disputes-list-nuqs";
import { Button } from "@auction/ui/components/button";
import { useTransition } from "react";

type Props = {
  offset: number;
  limit: number;
  countOnPage: number;
  hasNextPage: boolean;
};

function rangeLabel(offset: number, countOnPage: number): string {
  const start = countOnPage === 0 ? 0 : offset + 1;
  const end = offset + countOnPage;
  return `Showing ${start}–${end}`;
}

/** Disputes pagination driven by nuqs (`offset`/`limit`, shallow:false). */
export function DisputesListPagination({ offset, limit, countOnPage, hasNextPage }: Props) {
  const [, setFilters] = useDisputesListNuqs();
  const [pending, startTransition] = useTransition();

  const hasPrev = offset > 0;
  const hasNext = hasNextPage;
  const range = rangeLabel(offset, countOnPage);

  if (!hasPrev && !hasNext) return null;

  return (
    <>
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
              onClick={() => {
                startTransition(() => {
                  void setFilters({ offset: Math.max(0, offset - limit) });
                });
              }}
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
              onClick={() => {
                startTransition(() => {
                  void setFilters({ offset: offset + limit });
                });
              }}
              aria-label="Next page"
            >
              Next page
            </Button>
          ) : null}
        </div>
      </div>
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
                onClick={() => {
                  startTransition(() => {
                    void setFilters({ offset: Math.max(0, offset - limit) });
                  });
                }}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!hasNext || pending}
                onClick={() => {
                  startTransition(() => {
                    void setFilters({ offset: offset + limit });
                  });
                }}
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
