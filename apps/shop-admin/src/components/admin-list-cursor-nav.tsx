import { Button } from "@auction/ui";
import Link from "next/link";

/**
 * Keyset paging for staff lists. The API only walks forward, so going back means returning to
 * the first page rather than stepping one page back.
 */
export function AdminListCursorNav({
  pathname,
  cursor,
  nextCursor,
}: {
  pathname: string;
  cursor: string | undefined;
  nextCursor: string | null;
}) {
  if (!cursor && !nextCursor) {
    return null;
  }
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap justify-between gap-2">
      {cursor ? (
        <Button variant="outline" size="md" asChild>
          <Link href={pathname}>First page</Link>
        </Button>
      ) : (
        <span />
      )}
      {nextCursor ? (
        <Button variant="outline" size="md" asChild>
          <Link href={`${pathname}?cursor=${encodeURIComponent(nextCursor)}`}>Next page</Link>
        </Button>
      ) : null}
    </nav>
  );
}
