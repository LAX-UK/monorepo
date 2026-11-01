/** Colour maths for text over a picture: sRGB blending, relative luminance and WCAG contrast. */

export type Rgb = readonly [number, number, number];

const HEX = /^#?([0-9a-f]{6})$/i;

export function parseHex(hex: string): Rgb {
  const match = HEX.exec(hex.trim());
  if (!match?.[1]) throw new Error(`invalid_hex_colour:${hex}`);
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function toHex(rgb: Rgb): string {
  const part = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, channel)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance, from 0 (black) to 1 (white). */
export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

/** WCAG contrast ratio between two colours, from 1 to 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `over` painted on `base` at `alpha`, composited in sRGB the way a browser does. */
export function blend(base: Rgb, over: Rgb, alpha: number): Rgb {
  const a = Math.min(1, Math.max(0, alpha));
  return [
    base[0] * (1 - a) + over[0] * a,
    base[1] * (1 - a) + over[1] * a,
    base[2] * (1 - a) + over[2] * a,
  ];
}

const WHITE: Rgb = [255, 255, 255];

/** White type must read on the plate field with room to spare, so no scrim is needed on it. */
export const PLATE_FIELD_MIN_CONTRAST = 13;

/** Darkens a colour, keeping its hue, until white reaches 13:1 on it. */
export function plateFieldColour(deepest: Rgb): Rgb {
  let field = deepest;
  for (let step = 0; step < 100 && contrastRatio(WHITE, field) < PLATE_FIELD_MIN_CONTRAST; step++) {
    field = [field[0] * 0.95, field[1] * 0.95, field[2] * 0.95];
  }
  return field;
}
