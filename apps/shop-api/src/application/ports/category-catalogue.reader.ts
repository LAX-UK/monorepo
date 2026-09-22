import type { SortLabelCursor } from "../catalogue-cursor.js";
import type { CategorySummaryReadModel } from "../read-models/catalogue.read-model.js";

export type ListPublicCategoriesInput = {
  limit: number;
  placement?: "featured_categories";
  cursor?: SortLabelCursor | null;
};

export type ListPublicCategoriesResult = {
  items: CategorySummaryReadModel[];
  nextCursor?: SortLabelCursor;
};

export interface CategoryCatalogueReader {
  listPublicCategories(input: ListPublicCategoriesInput): Promise<ListPublicCategoriesResult>;
  getPublicCategoryBySlug(slug: string): Promise<CategorySummaryReadModel | null>;
}
