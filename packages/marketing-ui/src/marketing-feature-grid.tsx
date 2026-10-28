import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import {
  type MarketingFeatureGridLayout,
  type MarketingFeatureGridRole,
  type MarketingFeatureGridVariant,
  marketingFeatureGridLayout,
  marketingFeatureGridRole,
} from "./marketing-row-layout.js";

export type { MarketingFeatureGridVariant } from "./marketing-row-layout.js";

export type MarketingFeatureGridProps<T> = {
  /**
   * The full layout, used from four items (`lead-plus-row`) or three (`lead-plus-stack`):
   * `lead-plus-row`: lead across the top, the rest in a row of three (Figma home "What's on", `285:3008`).
   * `lead-plus-stack`: lead on the left, the two secondary items stacked on the right (Figma home stories, `285:3061`).
   * With fewer items the grid recomposes (see `marketingFeatureGridLayout`), so no row is left mostly empty.
   */
  variant: MarketingFeatureGridVariant;
  /** The first item leads. */
  items: readonly T[];
  getKey: (item: T) => string;
  /** `feature` spans the content width, so the host gives it a wide image. */
  renderItem: (item: T, role: MarketingFeatureGridRole) => ReactNode;
  "aria-label"?: string;
  className?: string;
};

const LAYOUT_CLASS: Record<MarketingFeatureGridLayout, { list: string; lead: string }> = {
  feature: { list: "grid", lead: "" },
  pair: { list: "grid gap-x-6 gap-y-10 sm:grid-cols-2", lead: "" },
  "lead-plus-pair": { list: "grid gap-x-6 gap-y-10 sm:grid-cols-2", lead: "sm:col-span-2" },
  "lead-plus-row": {
    list: "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3",
    lead: "sm:col-span-2 lg:col-span-3",
  },
  "lead-plus-stack": { list: "grid gap-x-6 gap-y-10 lg:grid-cols-2", lead: "lg:row-span-2" },
};

/** Layout only: one emphasised item plus secondary items, all in one list for assistive tech. */
export function MarketingFeatureGrid<T>({
  variant,
  items,
  getKey,
  renderItem,
  "aria-label": ariaLabel,
  className,
}: MarketingFeatureGridProps<T>) {
  const layout = marketingFeatureGridLayout(variant, items.length);
  if (layout === null) return null;
  const classes = LAYOUT_CLASS[layout];

  return (
    <ul
      aria-label={ariaLabel}
      data-variant={variant}
      data-layout={layout}
      className={cn(classes.list, className)}
    >
      {items.map((item, index) => (
        <li key={getKey(item)} className={index === 0 ? classes.lead || undefined : undefined}>
          {renderItem(item, marketingFeatureGridRole(layout, index))}
        </li>
      ))}
    </ul>
  );
}
