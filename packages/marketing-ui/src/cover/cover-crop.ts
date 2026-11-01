import { COVER_BOXES, type CoverBoxName, coverCrop, cropKeepsArea } from "@auction/domain/cover";
import type { UnitRect } from "@auction/types";
import type { CoverPhotoMedia, CoverPhotoSlot, CoverSide } from "./cover-types.js";

/** From this viewport width the wide box takes over from the desktop box. */
export const COVER_WIDE_FROM_PX = 1600;

/** The wide and phone pictures are used only when they are large enough for their box at 2x. */
const WIDE_MIN = { width: 2880, height: 1080 } as const;
const PHONE_MIN = { width: 1200, height: 1200 } as const;
const ZOOM_STEP = 0.1;

export type ResolvedCoverCrop = {
  crop: UnitRect;
  zoom: number;
  /** False when even the whole picture could not keep the "keep in frame" area visible. */
  keepsArea: boolean;
};

function roundZoom(zoom: number): number {
  return Math.round(zoom * 100) / 100;
}

/**
 * The part of a slot's picture one hero box shows. The focal point goes on the third away from
 * the type. If a "keep in frame" area would be cut, the zoom backs off a step at a time toward
 * the whole picture; if it still would be, the crop centres on the area instead of the third.
 */
export function resolveCoverCrop(input: {
  slot: Pick<CoverPhotoSlot, "width" | "height" | "focal" | "keep" | "zoom">;
  box: CoverBoxName;
  side: CoverSide;
}): ResolvedCoverCrop {
  const { slot, box, side } = input;
  const size = COVER_BOXES[box];
  const textSide = box === "phone" ? null : side;
  const at = (zoom: number, focal = slot.focal) =>
    coverCrop({
      image: { width: slot.width, height: slot.height },
      box: size,
      focal,
      zoom,
      textSide,
    });
  const keep = slot.keep;
  if (!keep) return { crop: at(slot.zoom), zoom: slot.zoom, keepsArea: true };

  let zoom = slot.zoom;
  for (;;) {
    const crop = at(zoom);
    if (cropKeepsArea(crop, keep)) return { crop, zoom, keepsArea: true };
    if (zoom <= 1) break;
    zoom = Math.max(1, roundZoom(zoom - ZOOM_STEP));
  }
  const centred = at(1, { x: keep.x + keep.width / 2, y: keep.y + keep.height / 2 });
  return { crop: centred, zoom: 1, keepsArea: cropKeepsArea(centred, keep) };
}

function meets(slot: CoverPhotoSlot, min: { width: number; height: number }): boolean {
  return slot.width >= min.width && slot.height >= min.height;
}

/**
 * The slot that serves a hero box: the wide slot on wide screens and the phone slot on phones
 * when they exist and are large enough, otherwise the default slot cropped for that box.
 */
export function slotForBox(slots: CoverPhotoMedia["slots"], box: CoverBoxName): CoverPhotoSlot {
  if (box === "wide" && slots.wide && meets(slots.wide, WIDE_MIN)) return slots.wide;
  if (box === "phone" && slots.phone && meets(slots.phone, PHONE_MIN)) return slots.phone;
  return slots.default;
}

/** Where the full picture is drawn inside its box, in percent of the box. */
export type CoverImageFrame = { width: number; height: number; left: number; top: number };

/** Positions the full picture inside its box so only the crop shows (overflow hidden on the box). */
export function cropToFrame(crop: UnitRect): CoverImageFrame {
  return {
    width: 100 / crop.width,
    height: 100 / crop.height,
    left: -(crop.x / crop.width) * 100 || 0,
    top: -(crop.y / crop.height) * 100 || 0,
  };
}

export type CoverBoxPlan = { slot: CoverPhotoSlot; frame: CoverImageFrame; keepsArea: boolean };

/** For each hero box: which slot serves it and how it is framed. */
export function planCoverBoxes(media: CoverPhotoMedia): Record<CoverBoxName, CoverBoxPlan> {
  const plan = (box: CoverBoxName): CoverBoxPlan => {
    const slot = slotForBox(media.slots, box);
    const { crop, keepsArea } = resolveCoverCrop({ slot, box, side: media.side });
    return { slot, frame: cropToFrame(crop), keepsArea };
  };
  return { phone: plan("phone"), desktop: plan("desktop"), wide: plan("wide") };
}
