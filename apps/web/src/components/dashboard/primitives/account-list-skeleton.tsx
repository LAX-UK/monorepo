import { cn } from "@auction/ui";
import { Skeleton } from "@auction/ui/components/skeleton";

type AccountListSkeletonProps = {
  /** Read by screen readers while the list loads ("Loading your bids"). */
  label: string;
  /** Card rows (bids, purchases, notifications) or a grid of lot tiles (Watching). */
  shape?: "rows" | "tiles";
  /** Leave out the view tabs for pages that have none. */
  tabs?: boolean;
  className?: string;
};

const ROWS = ["a", "b", "c"] as const;
const TILES = ["a", "b", "c", "d"] as const;

function Row() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-outline-variant/40 p-4">
      <Skeleton className="size-18 shrink-0 md:size-24" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Skeleton className="h-3 w-40 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-3 w-52 max-w-full" />
      </div>
    </div>
  );
}

function Tile() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-[4/5] w-full rounded-lg" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/**
 * The account pages' loading state: the shape of what is coming (view tabs, then cards or lot
 * tiles) in quiet shimmer, so the page does not jump when the list arrives.
 */
export function AccountListSkeleton({
  label,
  shape = "rows",
  tabs = true,
  className,
}: AccountListSkeletonProps) {
  return (
    <output aria-label={label} className={cn("flex flex-col gap-5", className)}>
      {tabs ? <Skeleton className="h-11 w-full rounded-lg md:w-72" /> : null}
      {shape === "rows" ? (
        <div className="flex flex-col gap-3">
          {ROWS.map((key) => (
            <Row key={key} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4">
          {TILES.map((key) => (
            <Tile key={key} />
          ))}
        </div>
      )}
    </output>
  );
}
