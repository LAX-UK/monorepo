import { cn } from "@auction/ui/lib/utils";
import type { ReactNode } from "react";

type Props = {
  /** "Lot 12"; without a number the line keeps its height so a row of cards stays aligned. */
  label: string | null;
  /** The save heart, at the right end of the line. */
  save?: ReactNode;
  className?: string;
};

/**
 * The heart on the line is the toolbar heart (`MarketingWatchlistHeart`, 44px tap area) without
 * its round chrome: a quiet outline, filled in the Bid accent when saved. Styled from here, so the
 * shared heart (and every page that ships it) is unchanged.
 */
const QUIET_HEART =
  "-my-2.5 -mr-3 flex shrink-0 [&_button]:border-transparent [&_button]:bg-transparent [&_button]:text-on-surface-variant [&_button:hover]:bg-transparent [&_button:hover]:text-on-surface [&_.fill-live-red]:fill-product-accent [&_.fill-live-red]:stroke-product-accent";

/**
 * The "Lot N" line under a lot card's picture, with the save heart at its right end. The picture
 * itself carries nothing but the sale status pill. The heart keeps its 44px tap area by reaching
 * past the line's own height (negative margins), so the line stays a quiet 24px row.
 */
export function LotCardLotLine({ label, save, className }: Props) {
  return (
    <div
      data-testid="lot-card-lot-line"
      className={cn("flex min-h-6 items-center justify-between gap-2", className)}
    >
      <p
        className={cn(
          "min-h-4 font-label text-xs font-medium leading-4 text-on-surface-variant",
          !label && "invisible",
        )}
      >
        {label ?? "Lot"}
      </p>
      {save ? <div className={QUIET_HEART}>{save}</div> : null}
    </div>
  );
}
