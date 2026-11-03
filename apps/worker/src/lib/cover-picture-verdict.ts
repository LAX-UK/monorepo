import { COVER_PLATE_MIN_LONG_SIDE, COVER_SLOT_FLOORS } from "@auction/domain";
import type { SaleCoverSlotName } from "@auction/types";

export type PictureSize = { width: number; height: number };

export type PictureVerdict =
  | { ok: true }
  | { ok: false; reason: string; need: string; have: string };

function sizeText(size: PictureSize): string {
  return `${size.width} × ${size.height}`;
}

/** Whether a lot photograph is big enough to hang whole on the cover plate. */
export function lotPlateVerdict(size: PictureSize): PictureVerdict {
  if (Math.max(size.width, size.height) >= COVER_PLATE_MIN_LONG_SIDE) return { ok: true };
  return {
    ok: false,
    reason: "below_plate_floor",
    need: `long side ${COVER_PLATE_MIN_LONG_SIDE} px`,
    have: sizeText(size),
  };
}

/** Whether a picture meets the floor of a named cover slot (before any zoom). */
export function coverSlotVerdict(name: SaleCoverSlotName, size: PictureSize): PictureVerdict {
  const floor = COVER_SLOT_FLOORS[name];
  if (size.width >= floor.minWidth && size.height >= floor.minHeight) return { ok: true };
  return {
    ok: false,
    reason: "below_slot_floor",
    need: `${floor.minWidth} × ${floor.minHeight || "any"} for ${name}`,
    have: sizeText(size),
  };
}
