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
  query = {},
}: {
  pathname: string;
  cursor: string | undefined;
  nextCursor: string | null;
  /** Search and filter state to keep in the links, so paging does not drop it. */
  query?: Record<string, string>;
}) {
  if (!cursor && !nextCursor) {
    return null;
  }
  const href = (extra: Record<string, string>) => {
    const search = new URLSearchParams({ ...query, ...extra }).toString();
    return search ? `${pathname}?${search}` : pathname;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap justify-between gap-2">
      {cursor ? (
        <Button variant="outline" size="md" asChild>
          <Link href={href({})}>First page</Link>
        </Button>
      ) : (
        <span />
      )}
      {nextCursor ? (
        <Button variant="outline" size="md" asChild>
          <Link href={href({ cursor: nextCursor })}>Next page</Link>
        </Button>
      ) : null}
    </nav>
  );
}
