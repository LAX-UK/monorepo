import { Skeleton } from "@auction/ui";

type NotificationsSkeletonProps = {
  rows?: number;
};

/** Bone-rows that mirror {@link NotificationRow}'s layout so the inbox
 * doesn't visibly reflow when data arrives.
 */
export function NotificationsSkeleton({ rows = 6 }: NotificationsSkeletonProps) {
  const items = Array.from({ length: Math.max(1, rows) }, (_, i) => i);
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
      <ul
        aria-busy="true"
        aria-label="Loading notifications"
        className="divide-y divide-outline-variant/10"
      >
        {items.map((i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-4">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-3 w-full max-w-[480px]" />
              <Skeleton className="h-3 w-3/5" />
            </div>
            <Skeleton className="h-7 w-16 shrink-0 rounded-md" />
          </li>
        ))}
      </ul>
    </div>
  );
}
