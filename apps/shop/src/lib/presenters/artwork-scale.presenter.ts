import type { PublicArtworkDetail } from "@auction/shop-contracts";

/**
 * A wall drawn to scale in centimetres: the artwork hung above a standard three-seat sofa, so a
 * shopper can judge its real size. Every number is in cm, and the drawing's viewBox uses the same
 * units, so nothing is resized for effect.
 */
export type ArtworkScaleVm = {
  /** The whole wall, in cm. */
  scene: { width: number; height: number };
  /** Top-left corner and size, in cm from the top-left of the wall. */
  artwork: { x: number; y: number; width: number; height: number };
  sofa: { x: number; y: number; width: number; height: number; seatHeight: number };
  /** "50 × 40 cm, drawn to scale above a 200 cm sofa." */
  caption: string;
  /** Text equivalent of the drawing for screen readers. */
  description: string;
};

/** A typical three-seat sofa: 200 cm wide, back 85 cm high, seat 45 cm high. */
export const SCALE_SOFA = { width: 200, height: 85, seatHeight: 45 } as const;
/** Gallery hanging height: the centre of the work at 150 cm, and at least 20 cm above the sofa. */
const HANG_CENTRE_CM = 150;
const CLEARANCE_ABOVE_SOFA_CM = 20;
/** Larger than any edition on paper; a value beyond this is a catalogue error, not a size. */
const MAX_PLAUSIBLE_CM = 1000;

function plausible(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0 && value <= MAX_PLAUSIBLE_CM;
}

function cm(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}

/** Null without a usable height and width, so the page shows the size as text instead. */
export function presentArtworkScale(
  artwork: Pick<PublicArtworkDetail, "heightCm" | "widthCm" | "title">,
): ArtworkScaleVm | null {
  const { heightCm: height, widthCm: width } = artwork;
  if (!plausible(height) || !plausible(width)) return null;

  const bottom = Math.max(SCALE_SOFA.height + CLEARANCE_ABOVE_SOFA_CM, HANG_CENTRE_CM - height / 2);
  const sceneWidth = Math.max(SCALE_SOFA.width + 100, width + 60);
  const sceneHeight = Math.max(240, bottom + height + 25);

  return {
    scene: { width: sceneWidth, height: sceneHeight },
    artwork: {
      x: (sceneWidth - width) / 2,
      y: sceneHeight - bottom - height,
      width,
      height,
    },
    sofa: {
      x: (sceneWidth - SCALE_SOFA.width) / 2,
      y: sceneHeight - SCALE_SOFA.height,
      width: SCALE_SOFA.width,
      height: SCALE_SOFA.height,
      seatHeight: SCALE_SOFA.seatHeight,
    },
    caption: `${cm(height)} × ${cm(width)} cm, drawn to scale above a ${SCALE_SOFA.width} cm sofa.`,
    description: `${artwork.title}, ${cm(height)} cm high and ${cm(width)} cm wide, drawn to scale on a wall above a sofa ${SCALE_SOFA.width} cm wide.`,
  };
}
