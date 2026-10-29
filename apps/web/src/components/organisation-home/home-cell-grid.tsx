import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { HOME_PANEL_CLASS } from "./home-section";

/** Columns on phones, then from `lg`; class names are spelled out so Tailwind keeps them. */
const PHONE_COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } as const;
const WIDE_COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};
const SPAN = { 2: "col-span-2", 3: "col-span-3" } as const;

/**
 * A link that fills a cell or a row of a Home card: a darker surface on hover and press, and a
 * focus ring drawn inside, as the card clips its corners.
 */
export const HOME_CELL_LINK_CLASS =
  "transition-colors duration-150 hover:bg-surface-container-low active:bg-surface-container focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

type Props<T> = {
  labelledBy: string;
  items: readonly T[];
  itemKey: (item: T) => string;
  /** Columns on phones; the last cell widens so no row ends in a gap. */
  phoneColumns: keyof typeof PHONE_COLUMNS;
  /** Columns from `lg`, at most six. */
  wideColumns: number;
  renderItem: (item: T) => ReactNode;
  itemTestId?: (item: T) => string;
};

/**
 * Figures as cells of one card, split by hairlines: one surface, never a card inside a card.
 * Each cell fills its row, so a link inside it is the whole cell.
 */
export function HomeCellGrid<T>({
  labelledBy,
  items,
  itemKey,
  phoneColumns,
  wideColumns,
  renderItem,
  itemTestId,
}: Props<T>) {
  const columns = Math.min(phoneColumns, items.length) as keyof typeof PHONE_COLUMNS;
  const remainder = items.length % columns;
  return (
    <ul
      aria-labelledby={labelledBy}
      className={cn(
        HOME_PANEL_CLASS,
        // The hairlines are the card's own colour showing through a 1px gap.
        "grid gap-px overflow-hidden bg-border-hairline",
        PHONE_COLUMNS[columns],
        WIDE_COLUMNS[Math.min(wideColumns, items.length)],
      )}
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        const span = last && remainder > 0 ? columns - remainder + 1 : 1;
        return (
          <li
            key={itemKey(item)}
            className={cn(
              "flex min-w-0 bg-surface-container-lowest",
              span > 1 && [SPAN[span as keyof typeof SPAN], "lg:col-span-1"],
            )}
            {...(itemTestId ? { "data-testid": itemTestId(item) } : {})}
          >
            {renderItem(item)}
          </li>
        );
      })}
    </ul>
  );
}
