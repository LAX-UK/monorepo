import type { CatalogueFilterOption } from "@/components/catalogue/artwork-catalogue-filter-body";

/**
 * Filter options with their counts. With counts, the options are exactly those that have works
 * (in the order the counts come in); without them, every listed option shows, uncounted.
 */
export function buildCatalogueFilterOptions(
  listed: ReadonlyArray<{ slug: string; label: string }>,
  counted: ReadonlyArray<{ slug: string; label: string; count: number }> | undefined,
): CatalogueFilterOption[] {
  if (!counted) return listed.map((option) => ({ ...option }));
  return counted.map((option) => ({ slug: option.slug, label: option.label, count: option.count }));
}
