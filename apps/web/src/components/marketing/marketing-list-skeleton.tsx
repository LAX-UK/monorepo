import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { cn } from "@auction/ui";

const block = "shimmer-sweep rounded bg-surface-container-high";

type Props = {
  view: CatalogLayoutView;
  count?: number;
  className?: string;
};

/** Placeholder list bodies for marketing routes — matches grid / card / list chrome. */
export function MarketingListSkeleton({ view, count = 9, className }: Props) {
  const keys = Array.from({ length: count }, (_, i) => `sk-${i}`);

  if (view === "list") {
    return (
      <div
        className={cn(
          "-mx-4 max-w-none border-y border-border-hairline bg-surface-container-lowest sm:mx-auto sm:max-w-screen-2xl sm:rounded-xl sm:border sm:border-border-hairline",
          className,
        )}
      >
        <ul className="m-0 list-none divide-y divide-outline-variant/15 p-0 sm:rounded-xl">
          {keys.map((k) => (
            <li key={k} className="flex gap-4 p-4 sm:gap-5 sm:p-5">
              <div className={cn(block, "size-20 shrink-0 rounded-lg sm:size-24")} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className={cn(block, "h-5 w-3/4")} aria-hidden />
                <div className={cn(block, "h-3 w-full max-w-md")} aria-hidden />
                <div className={cn(block, "mt-2 h-3 w-24")} aria-hidden />
              </div>
              <div className={cn(block, "h-8 w-20 shrink-0 self-center")} aria-hidden />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (view === "card") {
    const cardKeys = keys.slice(0, Math.min(6, count));
    return (
      <ul className={cn("mx-auto flex max-w-2xl list-none flex-col gap-10 p-0", className)}>
        {cardKeys.map((k) => (
          <li key={k} className="space-y-3">
            <div className={cn(block, "aspect-[16/10] w-full rounded-xl")} aria-hidden />
            <div className={cn(block, "h-6 w-full max-w-lg")} aria-hidden />
            <div className={cn(block, "h-4 w-1/2 max-w-xs")} aria-hidden />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      className={cn(
        "m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-2 md:gap-8 lg:grid-cols-3",
        className,
      )}
    >
      {keys.map((k) => (
        <li key={k} className="space-y-3">
          <div className={cn(block, "aspect-[4/5] w-full rounded-lg")} aria-hidden />
          <div className={cn(block, "h-5 w-full max-w-sm")} aria-hidden />
          <div className={cn(block, "h-3 w-1/3 max-w-[8rem]")} aria-hidden />
        </li>
      ))}
    </ul>
  );
}
