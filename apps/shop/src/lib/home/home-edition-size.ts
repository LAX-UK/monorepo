import type { PublicArtworkSummary } from "@auction/shop-contracts";

export type EditionSizeCm = { heightCm: number; widthCm: number };

const AXIS = (letter: "H" | "W") => new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*cm\\s*${letter}\\b`, "i");

function numberOf(match: RegExpExecArray | null): number | null {
  if (!match?.[1]) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Reads "70 cm H × 100 cm W" as written by the catalogue; anything else is not guessed at. */
export function editionSizeCm(
  item: Pick<PublicArtworkSummary, "dimensionsCmDisplay">,
): EditionSizeCm | null {
  const display = item.dimensionsCmDisplay;
  if (!display) return null;
  const heightCm = numberOf(AXIS("H").exec(display));
  const widthCm = numberOf(AXIS("W").exec(display));
  return heightCm !== null && widthCm !== null ? { heightCm, widthCm } : null;
}

function trimmed(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

/** "120 × 90 cm": height, then width. */
export function editionSizeLabel(size: EditionSizeCm | null): string | null {
  return size ? `${trimmed(size.heightCm)} × ${trimmed(size.widthCm)} cm` : null;
}
