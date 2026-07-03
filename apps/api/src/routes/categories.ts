import { Hono } from "hono";
import type { ContainerCategoryRoutesSlice } from "../container.js";

export function createCategoryRoutes(container: ContainerCategoryRoutesSlice) {
  const r = new Hono();

  r.get("/", async (c) => {
    const data = await container.categoryService.list();
    return c.json({ data });
  });

  return r;
}
