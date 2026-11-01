import { effectiveCoverSize } from "@auction/domain/cover";
import type { CoverMedia } from "./cover-types.js";

/** A picture at least this wide is sharp enough to stay still. */
export const SETTLE_SHARP_WIDTH = 2880;

/** The one motion: the picture settles from 1.00 to 1.03 over 14 seconds. */
export const SETTLE_SCALE = { from: 1, to: 1.03 } as const;
export const SETTLE_SECONDS = 14;

/**
 * Whether the cover settles: plates and type covers always do, a photograph only when it is
 * under 2880px wide once the zoom has chosen its detail. Reduced motion is handled in CSS, which
 * drops the animation, so this stays a pure choice about the picture.
 */
export function coverSettles(media: CoverMedia | null): boolean {
  if (!media || media.kind === "plate") return true;
  return effectiveCoverSize(media.slots.default).width < SETTLE_SHARP_WIDTH;
}
