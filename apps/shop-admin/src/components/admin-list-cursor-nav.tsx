import Link from "next/link";

export function AdminListCursorNav({
  pathname,
  nextCursor,
}: {
  pathname: string;
  nextCursor: string | null;
}) {
  if (!nextCursor) {
    return null;
  }
  const href = `${pathname}?cursor=${encodeURIComponent(nextCursor)}`;
  return (
    <div className="mt-4">
      <Link href={href} className="text-sm underline">
        Next
      </Link>
    </div>
  );
}
