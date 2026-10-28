import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import {
  MARKETING_ROW_LAYOUT_CLASS,
  type MarketingRowLayout,
  marketingRowLayout,
} from "./marketing-row-layout.js";

export type MarketingCardRowProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /** `feature` means the item spans the content width, so the host gives it its wide form. */
  renderItem: (item: T, layout: MarketingRowLayout, index: number) => ReactNode;
  "aria-label": string;
  className?: string;
};

/**
 * A list of cards that recomposes for its count (`marketingRowLayout`): a wide feature for one,
 * a pair for two, the grid for three or more. Renders nothing when there are no items.
 */
export function MarketingCardRow<T>({
  items,
  getKey,
  renderItem,
  "aria-label": ariaLabel,
  className,
}: MarketingCardRowProps<T>) {
  const layout = marketingRowLayout(items.length);
  if (layout === null) return null;
  return (
    <ul
      aria-label={ariaLabel}
      data-layout={layout}
      className={cn("m-0 list-none p-0", MARKETING_ROW_LAYOUT_CLASS[layout], className)}
    >
      {items.map((item, index) => (
        <li key={getKey(item)}>{renderItem(item, layout, index)}</li>
      ))}
    </ul>
  );
}
