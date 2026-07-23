import type { CatalogHttpJson } from "./catalog-read-http.js";

export interface ICatalogCategoryReadHttpApplicationService {
  listCategories(): Promise<CatalogHttpJson>;
}
