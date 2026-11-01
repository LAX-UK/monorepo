import type {
  CoverBreakpointName,
  CoverTextSide,
  SaleCoverSlotName,
  UnitPoint,
  UnitRect,
} from "@auction/types";

/** The hero box at each size, in CSS pixels. The phone plate carries no text on the picture. */
export const COVER_BOXES = {
  desktop: { width: 1440, height: 640 },
  wide: { width: 1920, height: 720 },
  phone: { width: 375, height: 340 },
} as const;

export type CoverBoxName = keyof typeof COVER_BOXES;

/** Where the focal point lands in the box when the text is on the left (mirrored for the right). */
const FOCAL_TARGET_X_TEXT_LEFT = 0.68;
const FOCAL_TARGET_Y = 0.5;

/** A focal point left of this puts the text on the right, so it never sits on the subject. */
const SUBJECT_ON_LEFT_BELOW = 0.45;

const EDGE_TOLERANCE = 1e-6;

export function suggestCoverSide(focal: UnitPoint): CoverTextSide {
  return focal.x < SUBJECT_ON_LEFT_BELOW ? "right" : "left";
}

export type CoverCropInput = {
  image: { width: number; height: number };
  box: { width: number; height: number };
  focal: UnitPoint;
  zoom: number;
  /** The side the text sits on; `null` for the phone plate, which centres the focal point. */
  textSide: CoverTextSide | null;
};

/**
 * The part of the picture the hero shows, in 0 to 1 picture units.
 *
 * The picture is scaled to cover the box (times the zoom), shifted so the focal point lands on
 * the third away from the text, then clamped so the box is always filled.
 */
export function coverCrop(input: CoverCropInput): UnitRect {
  const { image, box, focal, zoom, textSide } = input;
  const scale = Math.max(box.width / image.width, box.height / image.height) * zoom;
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  const targetX =
    textSide === null
      ? 0.5
      : textSide === "left"
        ? FOCAL_TARGET_X_TEXT_LEFT
        : 1 - FOCAL_TARGET_X_TEXT_LEFT;
  const offsetX = clamp(targetX * box.width - focal.x * drawnWidth, box.width - drawnWidth, 0);
  const offsetY = clamp(
    FOCAL_TARGET_Y * box.height - focal.y * drawnHeight,
    box.height - drawnHeight,
    0,
  );
  return {
    x: -offsetX / drawnWidth,
    y: -offsetY / drawnHeight,
    width: box.width / drawnWidth,
    height: box.height / drawnHeight,
  };
}

/** True when the whole keep-in-frame area is inside the visible part of the picture. */
export function cropKeepsArea(crop: UnitRect, keep: UnitRect): boolean {
  return (
    keep.x >= crop.x - EDGE_TOLERANCE &&
    keep.y >= crop.y - EDGE_TOLERANCE &&
    keep.x + keep.width <= crop.x + crop.width + EDGE_TOLERANCE &&
    keep.y + keep.height <= crop.y + crop.height + EDGE_TOLERANCE
  );
}

/** The boxes a slot is shown in. The default slot also serves the phone when it has none. */
export function boxesServedBySlot(
  slot: SaleCoverSlotName,
  phoneSlotPresent: boolean,
): readonly CoverBoxName[] {
  if (slot === "wide") return ["wide"];
  if (slot === "phone") return ["phone"];
  return phoneSlotPresent ? ["desktop", "wide"] : ["desktop", "wide", "phone"];
}

/** The text-bearing sizes a slot is measured at. The phone slot has no text on the picture. */
export function breakpointsMeasuredForSlot(
  slot: SaleCoverSlotName,
): readonly CoverBreakpointName[] {
  if (slot === "wide") return ["wide"];
  if (slot === "phone") return [];
  return ["desktop", "wide"];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
