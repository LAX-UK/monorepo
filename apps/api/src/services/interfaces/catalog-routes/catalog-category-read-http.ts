import type { CatalogHttpJson } from "./catalog-read-http.js";

export interface ICatalogCategoryReadHttpApplicationService {
  listCategories(): Promise<CatalogHttpJson>;
  /** Public browse filters: only categories with published lots. */
  listCategoriesWithPublishedLots(): Promise<CatalogHttpJson>;
}
