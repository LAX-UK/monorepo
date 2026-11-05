/** A count in tabular figures, safe to call from server and client components alike. */
const COUNT = new Intl.NumberFormat("en-GB");

/** Smallest unit first; a value that rounds up to 1,000 of one unit moves to the next. */
const COMPACT_UNITS = [
  { size: 1_000, suffix: "k" },
  { size: 1_000_000, suffix: "m" },
  { size: 1_000_000_000, suffix: "bn" },
] as const;

/**
 * A count in full ("1,284"); above 99,999 in compact form ("312k", "1m") so a tab keeps its size.
 * The compact form is built here rather than with Intl's compact notation, whose suffix differs
 * between ICU versions ("128K" on some servers, "128k" in browsers) and broke hydration.
 */
export function formatCount(value: number): string {
  if (value <= 99_999) return COUNT.format(value);
  for (const [index, { size, suffix }] of COMPACT_UNITS.entries()) {
    const rounded = Math.round(value / size);
    const isLastUnit = index === COMPACT_UNITS.length - 1;
    if (rounded < 1_000 || isLastUnit) return `${COUNT.format(rounded)}${suffix}`;
  }
  return COUNT.format(value);
}
