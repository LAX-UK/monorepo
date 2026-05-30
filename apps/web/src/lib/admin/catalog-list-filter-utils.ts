/** Count non-empty filter values for the "More filters" badge. */
export function countActiveCatalogFilters(
  values: readonly (string | null | undefined | false)[],
): number {
  return values.filter((v) => v != null && v !== false && String(v).trim() !== "").length;
}
