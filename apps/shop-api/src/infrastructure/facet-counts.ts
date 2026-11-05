/** The sale states a visitor can filter by, in the order the rail lists them. */
export const FACET_SALE_STATES = ["for_sale", "price_on_application", "sold"] as const;

/** Grouped counts in a fixed order, with only the keys that have works. */
export function orderedCounts(
  order: readonly string[],
  rows: ReadonlyArray<{ key: string | null; count: number | string }>,
): Array<{ key: string; count: number }> {
  const byKey = new Map(rows.map((row) => [row.key, Number(row.count)]));
  return order.flatMap((key) => {
    const total = byKey.get(key) ?? 0;
    return total > 0 ? [{ key, count: total }] : [];
  });
}
