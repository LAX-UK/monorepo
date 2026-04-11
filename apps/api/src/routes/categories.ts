import { Hono } from "hono";
import type { Container } from "../container.js";

export function createCategoryRoutes(container: Container) {
  const r = new Hono();

  r.get("/", async (c) => {
    const data = await container.categoryService.list();
    return c.json({ data });
  });

  return r;
}
