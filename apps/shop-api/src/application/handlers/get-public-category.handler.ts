import type { CategoryCatalogueReader } from "../ports/category-catalogue.reader.js";

export type GetPublicCategoryHandler = (
  slug: string,
) => ReturnType<CategoryCatalogueReader["getPublicCategoryBySlug"]>;

export function createGetPublicCategoryHandler(
  reader: CategoryCatalogueReader,
): GetPublicCategoryHandler {
  return (slug) => reader.getPublicCategoryBySlug(slug);
}
