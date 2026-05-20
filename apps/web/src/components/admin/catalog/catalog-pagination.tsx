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

  return (
    <>
      {hasMore ? (
        <div className="mt-6 flex justify-center md:hidden">
          <Button variant="secondary" size="sm" className="min-h-11 w-full max-w-sm" asChild>
            <Link href={nextHref}>Load more</Link>
          </Button>
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
