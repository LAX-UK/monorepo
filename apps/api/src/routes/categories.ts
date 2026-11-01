import { Hono } from "hono";
import type { ContainerCategoryRoutesSlice } from "../container.js";
import { respondCatalogHttpJson } from "../lib/catalog-route-response.js";

export function createCategoryRoutes(container: ContainerCategoryRoutesSlice) {
  const r = new Hono();

  r.get("/", async (c) => {
    const response = await container.catalogRoutes.categoryReadHttp.listCategories();
    return respondCatalogHttpJson(c, response);
  });

  r.get("/with-published-lots", async (c) => {
    const response =
      await container.catalogRoutes.categoryReadHttp.listCategoriesWithPublishedLots();
    return respondCatalogHttpJson(c, response);
  });

  return r;
}
