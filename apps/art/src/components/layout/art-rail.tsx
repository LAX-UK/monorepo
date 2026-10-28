import { MarketingHorizontalRail } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type ArtRailProps = {
  id: string;
  label: string;
  children: ReactNode;
};

/**
 * Shared horizontal rail (arrows + progress, snap scrolling); children are `ArtRailItem`s. The 8px
 * end padding holds the card's optically aligned favourite button (`-mr-2`), so a short rail whose
 * items stretch to the row does not read as scrollable.
 */
export function ArtRail({ id, label, children }: ArtRailProps) {
  return (
    <MarketingHorizontalRail
      id={id}
      ariaLabel={label}
      forwardAriaLabel={`Scroll ${label} forward`}
      backAriaLabel={`Scroll ${label} back`}
      controls="arrows-progress"
      scrollerAs="ul"
      scrollerClassName="art-focus-ring flex snap-x snap-mandatory gap-4 overflow-x-auto pe-2 pb-2 [scrollbar-width:none] lg:gap-6"
    >
      {children}
    </MarketingHorizontalRail>
  );
}

/**
 * Each item has a base width and may grow to twice that: a rail with more items than fit scrolls
 * at the base width, and a short rail stretches its items across the row instead of ending in
 * empty space.
 */
const ITEM_WIDTH = {
  tile: "w-[min(60vw,13rem)] max-w-[26rem]",
  card: "w-[min(70vw,16rem)] max-w-[32rem]",
  feature: "w-[min(85vw,28rem)] max-w-[56rem]",
} as const;

export function ArtRailItem({
  size = "card",
  children,
}: {
  size?: keyof typeof ITEM_WIDTH;
  children: ReactNode;
}) {
  return <li className={cn("shrink-0 grow snap-start", ITEM_WIDTH[size])}>{children}</li>;
}
