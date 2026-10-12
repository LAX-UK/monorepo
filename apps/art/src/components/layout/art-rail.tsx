import { MarketingHorizontalRail } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type ArtRailProps = {
  id: string;
  label: string;
  children: ReactNode;
};

/** Shared horizontal rail (arrows + progress, snap scrolling); children are `ArtRailItem`s. */
export function ArtRail({ id, label, children }: ArtRailProps) {
  return (
    <MarketingHorizontalRail
      id={id}
      ariaLabel={label}
      forwardAriaLabel={`Scroll ${label} forward`}
      backAriaLabel={`Scroll ${label} back`}
      controls="arrows-progress"
      scrollerAs="ul"
      scrollerClassName="art-focus-ring flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] lg:gap-6"
    >
      {children}
    </MarketingHorizontalRail>
  );
}

const ITEM_WIDTH = {
  tile: "w-[min(60vw,13rem)]",
  card: "w-[min(70vw,16rem)]",
  feature: "w-[min(85vw,28rem)]",
} as const;

export function ArtRailItem({
  size = "card",
  children,
}: {
  size?: keyof typeof ITEM_WIDTH;
  children: ReactNode;
}) {
  return <li className={cn("shrink-0 snap-start", ITEM_WIDTH[size])}>{children}</li>;
}
