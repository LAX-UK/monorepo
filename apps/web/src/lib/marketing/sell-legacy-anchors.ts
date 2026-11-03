import { SELL_HOW_TO_SELL_PATH } from "@/lib/marketing/sell-landing";

/**
 * Sections of the old selling guide that now live on the step by step page. A link to
 * `/sell#prepare` still lands on the right section. The sections that stayed on `/sell`
 * (`departments`, `how-it-works`, `fees`) keep their ids and need no move.
 */
const MOVED_SECTIONS: Readonly<Record<string, string>> = {
  prepare: "prepare",
  photos: "photos",
  valuation: "valuation",
};

/** Where a visitor with this URL hash belongs, or null when the hash stays on `/sell`. */
export function legacySellAnchorTarget(hash: string): string | null {
  const id = hash.replace(/^#/, "");
  const moved = MOVED_SECTIONS[id];
  return moved ? `${SELL_HOW_TO_SELL_PATH}#${moved}` : null;
}
