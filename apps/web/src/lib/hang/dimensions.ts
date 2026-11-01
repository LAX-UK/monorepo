/**
 * Reads a lot's display dimensions ("180 x 140 cm", "28 x 21 in. (71 x 53 cm)") into the long
 * side in centimetres, which is all the hang needs. A figure with no unit is not guessed at:
 * centimetres and inches differ by a factor of 2.5, so the wall would be wrong. Unreadable text
 * returns `null` and the hang falls back to salon mode.
 */

const UNIT_TO_CM = { cm: 1, mm: 0.1, in: 2.54 } as const;
type Unit = keyof typeof UNIT_TO_CM;

/** Preference order when one string gives the size in several units. */
const UNIT_PREFERENCE: readonly Unit[] = ["cm", "mm", "in"];

const NUMBER = "\\d+(?:[.,]\\d+)?";
const SEPARATOR = "\\s*(?:x|×|by)\\s*";
const MEASUREMENT = new RegExp(
  `(${NUMBER}(?:${SEPARATOR}${NUMBER}){0,2})\\s*(cm|mm|inches|inch|in\\b\\.?|")`,
  "gi",
);

function unitOf(token: string): Unit {
  const t = token.toLowerCase();
  if (t === "cm") return "cm";
  if (t === "mm") return "mm";
  return "in";
}

function numbersIn(text: string): number[] {
  return (text.match(new RegExp(NUMBER, "g")) ?? [])
    .map((n) => Number.parseFloat(n.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function longSideCmFromDimensions(text: string | null | undefined): number | null {
  if (!text) return null;
  const found = new Map<Unit, number>();
  for (const match of text.matchAll(MEASUREMENT)) {
    const [, figures, unitToken] = match;
    if (figures === undefined || unitToken === undefined) continue;
    // Height and width are the first two figures; a third is depth and never the long side.
    const sides = numbersIn(figures).slice(0, 2);
    if (sides.length === 0) continue;
    const unit = unitOf(unitToken);
    // "80cm x 100cm" repeats the unit after each figure: keep the larger.
    found.set(unit, Math.max(found.get(unit) ?? 0, Math.max(...sides) * UNIT_TO_CM[unit]));
  }
  for (const unit of UNIT_PREFERENCE) {
    const cm = found.get(unit);
    if (cm !== undefined) return Math.round(cm * 10) / 10;
  }
  return null;
}
