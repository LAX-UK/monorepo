/**
 * Composition rules for rows of cards, so a section never leaves a row mostly empty: one item
 * becomes a wide feature, two sit side by side, three or more fill the grid. Sections pick a
 * layout from the number of items they hold, never from a fixed column count.
 */
export type MarketingRowLayout = "feature" | "pair" | "grid";

/** `null` when there is nothing to show: the section hides. */
export function marketingRowLayout(count: number): MarketingRowLayout | null {
  if (count <= 0) return null;
  if (count === 1) return "feature";
  if (count === 2) return "pair";
  return "grid";
}

export const MARKETING_ROW_LAYOUT_CLASS: Record<MarketingRowLayout, string> = {
  feature: "grid grid-cols-1",
  pair: "grid gap-x-6 gap-y-10 sm:grid-cols-2",
  grid: "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * A horizontal rail reads as a rail only with enough items to fill the width it scrolls; with
 * fewer it is a short row ending in empty space, so the section hides instead.
 */
export const MARKETING_RAIL_MIN_ITEMS = 3;

export function marketingRailHasEnough(count: number): boolean {
  return count >= MARKETING_RAIL_MIN_ITEMS;
}

export type MarketingFeatureGridVariant = "lead-plus-row" | "lead-plus-stack";

/**
 * How a lead-and-secondaries grid recomposes for its item count.
 * - `feature`: one item across the width;
 * - `pair`: two equal items;
 * - `lead-plus-pair`: a wide lead with two items under it (three in a row-variant grid);
 * - `lead-plus-row`: a wide lead with a row of three under it;
 * - `lead-plus-stack`: a lead on the left with the others stacked beside it.
 */
export type MarketingFeatureGridLayout =
  | "feature"
  | "pair"
  | "lead-plus-pair"
  | "lead-plus-row"
  | "lead-plus-stack";

/**
 * `solo` is the only item, across the width (the host lays it out side by side, not as one huge
 * image); `feature` leads across the width above other items (a wide image); `lead` is the larger
 * item of a stack.
 */
export type MarketingFeatureGridRole = "solo" | "feature" | "lead" | "item";

export function marketingFeatureGridLayout(
  variant: MarketingFeatureGridVariant,
  count: number,
): MarketingFeatureGridLayout | null {
  const row = marketingRowLayout(count);
  if (row === null || row === "feature" || row === "pair") return row;
  if (variant === "lead-plus-stack") return "lead-plus-stack";
  return count === 3 ? "lead-plus-pair" : "lead-plus-row";
}

export function marketingFeatureGridRole(
  layout: MarketingFeatureGridLayout,
  index: number,
): MarketingFeatureGridRole {
  if (index > 0 || layout === "pair") return "item";
  if (layout === "feature") return "solo";
  return layout === "lead-plus-stack" ? "lead" : "feature";
}
