/** A count in tabular figures, safe to call from server and client components alike. */
const COUNT = new Intl.NumberFormat("en-GB");
const COMPACT_COUNT = new Intl.NumberFormat("en-GB", {
  notation: "compact",
  maximumFractionDigits: 0,
});

/** A count in full ("1,284"); above 99,999 in compact form ("312k") so a tab keeps its size. */
export function formatCount(value: number): string {
  return value > 99_999 ? COMPACT_COUNT.format(value) : COUNT.format(value);
}
