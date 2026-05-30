import { PaginationFooter } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  offset: number;
  limit: number;
  countOnPage: number;
  /** When set, shows "Showing X–Y of Z" on mobile and desktop. */
  total?: number;
  prevHref: string | null;
  nextHref: string | null;
};

function rangeLabel(offset: number, countOnPage: number, total?: number): string {
  const start = countOnPage === 0 ? 0 : offset + 1;
  const end = total !== undefined ? Math.min(offset + countOnPage, total) : offset + countOnPage;
  if (total !== undefined) {
    return `Showing ${start}–${end} of ${total}`;
  }
  return `Showing ${start}–${end}`;
}

/** Mobile prev/next + range summary; desktop uses PaginationFooter. */
export function CatalogPagination({
  offset,
  limit,
  countOnPage,
  total,
  prevHref,
  nextHref,
}: Props) {
  const hasMore = nextHref != null;
  const showMobileNav = prevHref != null || hasMore;
  const range = rangeLabel(offset, countOnPage, total);

  return (
    <>
      {showMobileNav || total !== undefined ? (
        <div className="mt-6 space-y-3 md:hidden">
          <p className="font-body text-sm text-on-surface-variant" aria-live="polite">
            {range}
          </p>
          <div className="flex flex-col gap-2">
            {prevHref ? (
              <Button variant="outline" size="sm" className="min-h-11 w-full max-w-sm" asChild>
                <Link href={prevHref} aria-label="Previous page">
                  Previous
                </Link>
              </Button>
            ) : null}
            {hasMore ? (
              <Button variant="secondary" size="sm" className="min-h-11 w-full max-w-sm" asChild>
                <Link href={nextHref} aria-label="Next page">
                  Next page
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-6 hidden md:block">
        <PaginationFooter
          offset={offset}
          limit={limit}
          countOnPage={countOnPage}
          {...(total !== undefined ? { total } : {})}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </div>
    </>
  );
}
