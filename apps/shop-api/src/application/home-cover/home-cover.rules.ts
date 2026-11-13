import { COVER_SLOT_FLOORS, slotScrimSettings, suggestCoverSide } from "@auction/domain";
import type { HomeCoverIssueReason } from "@auction/shop-contracts";
import type { CoverAnalysis, CoverBreakpointName, CoverTextSide, UnitPoint } from "@auction/types";

/** The narrowest picture the cover accepts: wide enough to stay sharp on a large screen. */
export const HOME_COVER_MIN_WIDTH = COVER_SLOT_FLOORS.default.minWidth;

/** The hero sizes with type over the picture, and so the sizes the picture is measured at. */
export const HOME_COVER_MEASURED_SIZES: readonly CoverBreakpointName[] = ["desktop", "wide"];

/** The type sits on the side away from the subject. */
export function homeCoverSide(focal: UnitPoint): CoverTextSide {
  return suggestCoverSide(focal);
}

/** What is wrong with the words and the picture's size, before any pixels are read. */
export function homeCoverInputIssues(input: {
  alt: string;
  width: number;
}): HomeCoverIssueReason[] {
  const issues: HomeCoverIssueReason[] = [];
  if (input.alt.trim().length === 0) issues.push("alt_missing");
  if (input.width < HOME_COVER_MIN_WIDTH) issues.push("picture_too_narrow");
  return issues;
}

/** The scrim to paint per hero size, from what was measured; the recommended tone for the type. */
export function homeCoverScrims(analysis: CoverAnalysis) {
  return slotScrimSettings("default", {}, analysis);
}

/** True when the type can reach contrast on the picture at the desktop size. */
export function homeCoverCanCarryType(analysis: CoverAnalysis): boolean {
  return homeCoverScrims(analysis).desktop != null;
}
