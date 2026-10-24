import { decodeSortLabelCursor } from "../catalogue-cursor.js";
import type {
  CategoryCatalogueReader,
  CategorySalesChannel,
} from "../ports/category-catalogue.reader.js";

export function createListPublicCategoriesHandler(reader: CategoryCatalogueReader) {
  return (input: {
    limit: number;
    placement?: "featured_categories";
    cursor?: string;
    salesChannel?: CategorySalesChannel;
  }) =>
    reader.listPublicCategories({
      limit: input.limit,
      ...(input.placement ? { placement: input.placement } : {}),
      ...(input.salesChannel ? { salesChannel: input.salesChannel } : {}),
      cursor: decodeSortLabelCursor(input.cursor ?? undefined),
    });
}
