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

/** The widest a row of cards gets: four columns on large screens. */
export const MARKETING_ROW_MAX_COLUMNS = 4;

/**
 * How many of `count` items a capped row shows: all of them up to `max` (default one row of
 * four), and beyond one row only whole rows, so a section never starts a partial second row.
 * Zero means the section hides. The host links to the rest ("View all N").
 */
export function marketingRowCap(count: number, max: number = MARKETING_ROW_MAX_COLUMNS): number {
  const available = Math.max(0, Math.min(Math.floor(count), Math.floor(max)));
  if (available <= MARKETING_ROW_MAX_COLUMNS) return available;
  return available - (available % MARKETING_ROW_MAX_COLUMNS);
}

/**
 * Large-screen columns for a capped row in the grid layout: three items sit as a row of three,
 * four or more as rows of four.
 */
export function marketingRowColumns(shown: number): 3 | 4 {
  return shown === 3 ? 3 : MARKETING_ROW_MAX_COLUMNS;
}

export const MARKETING_ROW_COLUMNS_CLASS: Record<3 | 4, string> = {
  3: "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4",
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

/**
 * How many of `count` items a `lead-plus-row` grid shows so its last row is whole: up to four
 * as they come (solo, pair, lead with two, lead with three), then the lead plus whole rows of
 * three. The host links to the rest when it has somewhere to send them.
 */
export function marketingLeadRowCap(count: number): number {
  const total = Math.max(0, Math.floor(count));
  if (total <= 4) return total;
  return 1 + Math.floor((total - 1) / 3) * 3;
}

/**
 * One slot of a mixed-size rail (Figma Art Hub stories, `983:27847`): a `tall` portrait card, a
 * `wide` landscape card, or a `pair` of compact cards stacked in one column.
 */
export type MarketingMixedRailSlot = {
  kind: "tall" | "wide" | "pair";
  /** Indexes of the items the slot holds, in reading order. */
  items: number[];
};

const MIXED_RAIL_PATTERN: readonly MarketingMixedRailSlot["kind"][] = ["tall", "wide", "pair"];

/**
 * Groups `count` items into the repeating tall, wide, pair rhythm. A pair never holds one item
 * (it would leave half a column empty), so a lone last item takes a tall slot instead.
 */
export function marketingMixedRailSlots(count: number): MarketingMixedRailSlot[] {
  const slots: MarketingMixedRailSlot[] = [];
  const total = Math.max(0, Math.floor(count));
  let next = 0;
  while (next < total) {
    const planned = MIXED_RAIL_PATTERN[slots.length % MIXED_RAIL_PATTERN.length] ?? "tall";
    const kind = planned === "pair" && total - next < 2 ? "tall" : planned;
    const size = kind === "pair" ? 2 : 1;
    slots.push({ kind, items: Array.from({ length: size }, (_, offset) => next + offset) });
    next += size;
  }
  return slots;
}
