import type { PublicArtworkDetail } from "@auction/shop-contracts";

/**
 * The work drawn to scale beside a person 1.7 m tall, so a shopper can judge its real size. Every
 * number is in cm, and the drawing's viewBox uses the same units, so nothing is resized for effect.
 */
export type ArtworkScaleVm = {
  /** The whole wall, in cm. */
  scene: { width: number; height: number };
  /** Top-left corner and size, in cm from the top-left of the wall. */
  artwork: { x: number; y: number; width: number; height: number };
  /** The standing figure, in the same units, its feet on the floor. */
  figure: { x: number; y: number; width: number; height: number };
  /** "50 × 40 cm, drawn to scale beside a 1.7 m figure." */
  caption: string;
  /** Text equivalent of the drawing for screen readers. */
  description: string;
};

/** The figure the work is drawn beside: 1.7 m tall and about 50 cm across the shoulders. */
export const SCALE_FIGURE = { height: 170, width: 50 } as const;
/** Gallery hanging height: the centre of the work at 150 cm, and its foot at least 60 cm up. */
const HANG_CENTRE_CM = 150;
const MIN_FOOT_CM = 60;
const GAP_CM = 40;
const MARGIN_CM = 30;
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

  const bottom = Math.max(MIN_FOOT_CM, HANG_CENTRE_CM - height / 2);
  const sceneWidth = MARGIN_CM + SCALE_FIGURE.width + GAP_CM + width + MARGIN_CM;
  const sceneHeight = Math.max(SCALE_FIGURE.height + 30, bottom + height + 25);

  return {
    scene: { width: sceneWidth, height: sceneHeight },
    artwork: {
      x: MARGIN_CM + SCALE_FIGURE.width + GAP_CM,
      y: sceneHeight - bottom - height,
      width,
      height,
    },
    figure: {
      x: MARGIN_CM,
      y: sceneHeight - SCALE_FIGURE.height,
      width: SCALE_FIGURE.width,
      height: SCALE_FIGURE.height,
    },
    caption: `${cm(height)} × ${cm(width)} cm, drawn to scale beside a 1.7 m figure.`,
    description: `${artwork.title}, ${cm(height)} cm high and ${cm(width)} cm wide, drawn to scale on a wall beside a figure 1.7 m tall.`,
  };
}
