import type { Lot } from "@auction/types";

export type ClosingPattern =
  | { kind: "none" }
  | { kind: "together" }
  | { kind: "staggered"; gapMinutes: number | null };

const MINUTE_MS = 60_000;

/** Lots in the order they close, then open, then by lot number. */
export function lotsInClosingOrder(lots: readonly Lot[]): Lot[] {
  return [...lots].sort(
    (a, b) =>
      new Date(a.endTime).getTime() - new Date(b.endTime).getTime() ||
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime() ||
      (a.lotNumber ?? Number.MAX_SAFE_INTEGER) - (b.lotNumber ?? Number.MAX_SAFE_INTEGER),
  );
}

/**
 * How the lots close: all at once, or one after another. When the gap between closing times is the
 * same throughout, it is reported so staff can read "a lot every 2 minutes".
 */
export function closingPattern(lots: readonly Lot[]): ClosingPattern {
  if (lots.length === 0) return { kind: "none" };
  const ends = [...new Set(lots.map((lot) => new Date(lot.endTime).getTime()))].sort(
    (a, b) => a - b,
  );
  if (ends.length <= 1) return { kind: "together" };
  const gaps = ends.slice(1).map((end, index) => end - (ends[index] as number));
  const first = gaps[0] as number;
  const even = gaps.every((gap) => gap === first) && first % MINUTE_MS === 0;
  return { kind: "staggered", gapMinutes: even ? first / MINUTE_MS : null };
}

/** The closing pattern as one sentence for the schedule section. */
export function closingPatternText(pattern: ClosingPattern): string {
  switch (pattern.kind) {
    case "none":
      return "No lots are attached yet.";
    case "together":
      return "All lots close together.";
    case "staggered":
      return pattern.gapMinutes != null
        ? `Staggered: a lot closes every ${pattern.gapMinutes === 1 ? "minute" : `${pattern.gapMinutes} minutes`}.`
        : "Staggered: lots close at different times.";
  }
}
