import type { SortLabelCursor } from "../catalogue-cursor.js";
import type { CategorySummaryReadModel } from "../read-models/catalogue.read-model.js";

export type CategorySalesChannel = "shop" | "art";

export type ListPublicCategoriesInput = {
  limit: number;
  placement?: "featured_categories";
  cursor?: SortLabelCursor | null;
  /**
   * Lists only categories with at least one live artwork in this channel, and counts only those
   * artworks. The Shop channel counts limited editions only. Omitted, every category is listed.
   */
  salesChannel?: CategorySalesChannel;
};

export type ListPublicCategoriesResult = {
  items: CategorySummaryReadModel[];
  nextCursor?: SortLabelCursor;
};

export interface CategoryCatalogueReader {
  listPublicCategories(input: ListPublicCategoriesInput): Promise<ListPublicCategoriesResult>;
  getPublicCategoryBySlug(slug: string): Promise<CategorySummaryReadModel | null>;
}
