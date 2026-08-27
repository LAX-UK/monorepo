type Category = { id: string; slug: string };

export function recommendationCategoryIds(
  selectedCategoryIds: readonly string[],
  categories: readonly Category[],
  excludedCategorySlugs: ReadonlySet<string>,
): string[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return selectedCategoryIds.filter((categoryId) => {
    const category = categoryById.get(categoryId);
    return category != null && !excludedCategorySlugs.has(category.slug);
  });
}

export function uniqueRecommendationRows<T extends { id: string }>(
  rows: readonly T[],
  limit = 3,
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
    if (unique.length === limit) break;
  }
  return unique;
}
