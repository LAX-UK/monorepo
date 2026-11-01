import {
  BAND_STOPS,
  RADIAL_RADIUS,
  RADIAL_STOPS,
  SCRIM_COLOUR,
  TEXT_STYLE,
} from "@auction/domain/cover";
import type { CoverScrimSetting, CoverTextLine } from "@auction/types";
import type { CoverPhotoMedia, CoverSide, CoverTone } from "./cover-types.js";

/**
 * How a page paints the scrim the domain solver measured. The shape (radii, eased stops, credit
 * band) and the colours are the solver's own constants, so what is painted is what was checked
 * for contrast. Only the stored strength and band opacity come from the picture.
 */

export type ScrimStop = { at: number; alpha: number };

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The radial stops as opacities, with `at` in percent of the radius. */
export function radialStops(strength: number): ScrimStop[] {
  return RADIAL_STOPS.map(([at, share]) => ({ at, alpha: round(strength * share) }));
}

/** The credit band's stops as opacities, with `at` in pixels up from the bottom edge. */
export function bandStops(creditBand: number): ScrimStop[] {
  return BAND_STOPS.map(([at, share]) => ({ at, alpha: round(creditBand * share) }));
}

/** Height of the credit band, from the solver's last stop. */
export const CREDIT_BAND_HEIGHT_PX = BAND_STOPS[BAND_STOPS.length - 1]?.[0] ?? 0;

function rgba(tone: CoverTone, alpha: number): string {
  const [r, g, b] = SCRIM_COLOUR[tone];
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Light falling from the corner under the text: an ellipse of 95% by 125% of the hero. */
export function scrimBackground(input: {
  side: CoverSide;
  tone: CoverTone;
  strength: number;
}): string {
  const origin = input.side === "left" ? "left bottom" : "right bottom";
  const radius = `${RADIAL_RADIUS.x * 100}% ${RADIAL_RADIUS.y * 100}%`;
  const stops = radialStops(input.strength)
    .map(({ at, alpha }) => `${rgba(input.tone, alpha)} ${at}%`)
    .join(", ");
  return `radial-gradient(ellipse ${radius} at ${origin}, ${stops})`;
}

/** The band along the bottom edge that carries the credit line. */
export function creditBandBackground(input: { tone: CoverTone; creditBand: number }): string {
  const stops = bandStops(input.creditBand)
    .map(({ at, alpha }) => `${rgba(input.tone, alpha)} ${at}px`)
    .join(", ");
  return `linear-gradient(to top, ${stops})`;
}

export type PhotoScrims = {
  tone: CoverTone;
  desktop: CoverScrimSetting;
  /** Only when the wide size was measured with the same tone, so one set of type colours serves both. */
  wide: CoverScrimSetting | null;
};

/** The scrims a photograph paints, or null when it has none for the desktop (it is not a source). */
export function scrimsForPhoto(media: Pick<CoverPhotoMedia, "scrim">): PhotoScrims | null {
  const desktop = media.scrim.desktop;
  if (!desktop) return null;
  const wide = media.scrim.wide;
  return { tone: desktop.tone, desktop, wide: wide && wide.tone === desktop.tone ? wide : null };
}

export type CoverTextVars = Record<`--cover-${CoverTextLine}`, string>;

/** The measured type colours for a tone, as CSS custom properties the cover reads on the image. */
export function coverTextVars(tone: CoverTone): CoverTextVars {
  const style = TEXT_STYLE[tone];
  const colour = (line: CoverTextLine) => {
    const { colour: rgb, alpha } = style[line];
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  };
  return {
    "--cover-eyebrow": colour("eyebrow"),
    "--cover-title": colour("title"),
    "--cover-sub": colour("sub"),
    "--cover-link": colour("link"),
    "--cover-credit": colour("credit"),
  };
}
