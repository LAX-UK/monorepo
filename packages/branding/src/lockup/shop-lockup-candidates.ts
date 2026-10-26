import { LAX_MARK_INK_PATHS, LAX_MARK_MIST_PATHS } from "./lax-mark-paths.js";
import type { LaxLockup, LockupPath } from "./lockup.js";
import { SHOP_TAG_PATHS } from "./shop-tag-paths.js";
import { TAGLINE_BOUNDS, TAGLINE_PATHS } from "./tagline-paths.js";

/**
 * Design checkpoint: candidate LAX Shop lockups and accents for the owner to choose from. Nothing
 * live reads these; once one pairing is chosen it moves into `laxLockup` and `PRODUCT_ACCENTS`.
 *
 * Every variant keeps the London Art Exchange wordmark exactly as it is (mark plus "London / Art
 * Exchange(R) / Marylebone") and adds "Shop" as a tag in the product accent, the way Bid adds
 * ".BID" and Account adds ".ID".
 */
export type ShopLockupVariant = keyof typeof SHOP_TAG_PATHS;

export const SHOP_LOCKUP_VARIANTS: readonly {
  id: ShopLockupVariant;
  letter: "a" | "b" | "c";
  name: string;
  summary: string;
}[] = [
  {
    id: "tagLine",
    letter: "a",
    name: ".SHOP after Marylebone",
    summary: "A tag on the address line, in the position and voice of Bid's .BID.",
  },
  {
    id: "besideName",
    letter: "b",
    name: "Shop beside Art Exchange",
    summary: "Reads as one name, “Art Exchange Shop”, at the size of the name.",
  },
  {
    id: "underMark",
    letter: "c",
    name: "SHOP under the mark",
    summary: "A small tracked descriptor under the mark; the wordmark beside it is untouched.",
  },
];

export type ShopAccentCandidate = {
  id: string;
  name: string;
  /** Text and UI colour on Shop's light surfaces (#ffffff to #eeeeee). */
  light: string;
  /** Text and UI colour on Shop's dark surfaces (#121414 to #2d2f2e). */
  dark: string;
  rationale: string;
};

/**
 * Three accents, each clear of Bid's midnight navy, Account's teal, and Shop's own success, warning
 * and danger colours. Both values pass 4.5:1 for text on every Shop surface (see the test).
 */
export const SHOP_ACCENT_CANDIDATES: readonly ShopAccentCandidate[] = [
  {
    id: "aubergine",
    name: "Aubergine",
    light: "#5a2a5c",
    dark: "#d6a8d4",
    rationale:
      "A deep red-violet, the colour of gallery walls and old print-room boards. No status uses violet, and it sits quietly beside warm and cool work alike.",
  },
  {
    id: "oxblood",
    name: "Oxblood",
    light: "#6e2433",
    dark: "#d9a3ab",
    rationale:
      "Warm, traditional and confident, like a bookbinder's leather. Darker and browner than the danger red, but the closest of the three to it.",
  },
  {
    id: "bronze",
    name: "Gilt bronze",
    light: "#6e5a1c",
    dark: "#d9bf72",
    rationale:
      "The tone of a gilt frame or a bronze edition stamp. Olive-gold rather than amber, so it stays clear of the warning orange.",
  },
];

/** Space under the mark's descriptor so antialiasing is not clipped. */
const FRAME_PAD = 0.5;

const plain = (paths: readonly string[]): LockupPath[] => paths.map((d) => ({ d }));

/** The wordmark with one candidate "Shop" tag; the tag is the accent-coloured descriptor. */
export function shopLockupCandidate(variant: ShopLockupVariant): LaxLockup {
  const tag = SHOP_TAG_PATHS[variant];
  const top = Math.floor(TAGLINE_BOUNDS.y) - FRAME_PAD;
  const right = Math.ceil(Math.max(TAGLINE_BOUNDS.right, tag.bounds.right)) + FRAME_PAD;
  const bottom = Math.ceil(Math.max(TAGLINE_BOUNDS.bottom, tag.bounds.bottom)) + FRAME_PAD;
  const height = bottom - top;
  return {
    kind: "shop",
    label: "LAX Shop, London Art Exchange",
    descriptor: "SHOP",
    viewBox: `0 ${top} ${right} ${height}`,
    width: right,
    height,
    ink: [...plain(LAX_MARK_INK_PATHS), ...plain(TAGLINE_PATHS)],
    mist: plain(LAX_MARK_MIST_PATHS),
    descriptorPaths: [{ d: tag.d }],
  };
}
