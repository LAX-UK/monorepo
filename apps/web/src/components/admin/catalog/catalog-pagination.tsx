import { PaginationFooter } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  offset: number;
  limit: number;
  countOnPage: number;
  prevHref: string | null;
  nextHref: string | null;
};

/** Mobile load-more + desktop prev/next. */
export function CatalogPagination({ offset, limit, countOnPage, prevHref, nextHref }: Props) {
  const hasMore = nextHref != null;

  const showMobileNav = prevHref != null || hasMore;

  return (
    <>
      {showMobileNav ? (
        <div className="mt-6 flex flex-col gap-2 md:hidden">
          {prevHref ? (
            <Button variant="outline" size="sm" className="min-h-11 w-full max-w-sm" asChild>
              <Link href={prevHref}>Previous</Link>
            </Button>
          ) : null}
          {hasMore ? (
            <Button variant="secondary" size="sm" className="min-h-11 w-full max-w-sm" asChild>
              <Link href={nextHref}>Next page</Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-6 hidden md:block">
        <PaginationFooter
          offset={offset}
          limit={limit}
          countOnPage={countOnPage}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      </div>
    </>
  );
}
