import type { ICatalogCategoryReadHttpApplicationService } from "../interfaces/catalog-routes/catalog-category-read-http.js";
import type { CatalogHttpJson } from "../interfaces/catalog-routes/catalog-read-http.js";
import type { ICategoryService } from "../interfaces/category-service.js";

export class CatalogCategoryReadHttpApplicationService
  implements ICatalogCategoryReadHttpApplicationService
{
  constructor(private readonly categoryService: ICategoryService) {}

  async listCategories(): Promise<CatalogHttpJson> {
    const data = await this.categoryService.list();
    return { status: 200, body: { data } };
  }
}
