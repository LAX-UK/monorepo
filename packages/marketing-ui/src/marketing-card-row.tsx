import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import {
  MARKETING_ROW_COLUMNS_CLASS,
  MARKETING_ROW_LAYOUT_CLASS,
  type MarketingRowLayout,
  marketingRowCap,
  marketingRowColumns,
  marketingRowLayout,
} from "./marketing-row-layout.js";

export type MarketingCardRowProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /** `feature` means the item spans the content width, so the host gives it its wide form. */
  renderItem: (item: T, layout: MarketingRowLayout, index: number) => ReactNode;
  /**
   * Caps the row (`marketingRowCap`): it shows at most `max` items, as one row of three or whole
   * rows of four, and never starts a partial row. The host links to the rest. Without it every
   * item shows in the open grid.
   */
  max?: number;
  "aria-label": string;
  className?: string;
};

function rowClass(layout: MarketingRowLayout, shown: number, capped: boolean): string {
  if (!capped || layout !== "grid") return MARKETING_ROW_LAYOUT_CLASS[layout];
  return MARKETING_ROW_COLUMNS_CLASS[marketingRowColumns(shown)];
}

/**
 * A list of cards that recomposes for its count (`marketingRowLayout`): a wide feature for one,
 * a pair for two, the grid for three or more. Renders nothing when there are no items.
 */
export function MarketingCardRow<T>({
  items,
  getKey,
  renderItem,
  max,
  "aria-label": ariaLabel,
  className,
}: MarketingCardRowProps<T>) {
  const capped = max !== undefined;
  const shown = capped ? items.slice(0, marketingRowCap(items.length, max)) : items;
  const layout = marketingRowLayout(shown.length);
  if (layout === null) return null;
  return (
    <ul
      aria-label={ariaLabel}
      data-layout={layout}
      className={cn("m-0 list-none p-0", rowClass(layout, shown.length, capped), className)}
    >
      {shown.map((item, index) => (
        <li key={getKey(item)}>{renderItem(item, layout, index)}</li>
      ))}
    </ul>
  );
}
