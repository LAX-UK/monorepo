import type { DepartmentDisplayStyle } from "@auction/domain";

/**
 * How the lot page presents a lot's pictures.
 * - single: one picture on the paper mat, with thumbnails when there are several
 * - angles: one picture on the studio ground and a strip of angles
 * - angles-zoom: a picture that fills its frame, a strip of angles, and zoom
 * - faces: the two faces of a piece (obverse and reverse) side by side
 * - swipe: a wide gallery to swipe through
 * - spread: two pages side by side, with zoom
 */
export type LotMediaLayout = "single" | "angles" | "angles-zoom" | "faces" | "swipe" | "spread";

export type LotMediaPlan = {
  layout: LotMediaLayout;
  /** The word for the strip of thumbnails; `null` where the layout has none. */
  stripLabel: string | null;
};

/** One layout per display style: a style is added here, not in an if-chain. */
const LAYOUT_BY_STYLE: Record<DepartmentDisplayStyle, LotMediaPlan> = {
  wall: { layout: "single", stripLabel: "Images" },
  object: { layout: "angles", stripLabel: "Angles" },
  product: { layout: "angles-zoom", stripLabel: "Angles" },
  showcase: { layout: "swipe", stripLabel: "Images" },
  document: { layout: "spread", stripLabel: "Pages" },
};

/**
 * The presentation for a lot: its department's style, with two exceptions that keep a lot
 * honest. A piece with two pictures whose department pairs faces (coins) shows them side by
 * side; and a lot with a single picture has no strip to show.
 */
export function lotMediaPlan(
  style: DepartmentDisplayStyle,
  imageCount: number,
  options: { pairsTwoFaces?: boolean } = {},
): LotMediaPlan {
  if (style === "product" && options.pairsTwoFaces && imageCount === 2) {
    return { layout: "faces", stripLabel: null };
  }
  const plan = LAYOUT_BY_STYLE[style];
  return imageCount > 1 ? plan : { ...plan, stripLabel: null };
}

/** The pictures a spread shows at `index`: the left and right pages of the pair it falls in. */
export function spreadPages(index: number, imageCount: number): number[] {
  if (imageCount <= 0) return [];
  const left = Math.min(index - (index % 2), imageCount - 1);
  return left + 1 < imageCount ? [left, left + 1] : [left];
}
