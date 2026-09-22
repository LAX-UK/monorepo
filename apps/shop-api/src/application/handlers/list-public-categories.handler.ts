import { decodeSortLabelCursor } from "../catalogue-cursor.js";
import type { CategoryCatalogueReader } from "../ports/category-catalogue.reader.js";

export function createListPublicCategoriesHandler(reader: CategoryCatalogueReader) {
  return (input: {
    limit: number;
    placement?: "featured_categories";
    cursor?: string;
  }) =>
    reader.listPublicCategories({
      limit: input.limit,
      ...(input.placement ? { placement: input.placement } : {}),
      cursor: decodeSortLabelCursor(input.cursor ?? undefined),
    });
}
