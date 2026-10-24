import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

function createDeps() {
  const deps = createMinimalShopApiTestDeps();
  const listPublicCategories = vi.fn(async () => ({
    items: [{ slug: "prints", label: "Prints", imageUrl: null, artworkCount: 3 }],
  }));
  deps.catalogue.listPublicCategories = listPublicCategories;
  return { deps, listPublicCategories };
}

describe("category routes", () => {
  it("passes the Shop sales channel to the listing", async () => {
    const { deps, listPublicCategories } = createDeps();
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/categories?salesChannel=shop&placement=featured_categories",
    });
    expect(response.statusCode).toBe(200);
    expect(listPublicCategories).toHaveBeenCalledWith({
      limit: 50,
      placement: "featured_categories",
      salesChannel: "shop",
    });
    await app.close();
  });

  it("lists every category when no channel is given, as lax.art asks", async () => {
    const { deps, listPublicCategories } = createDeps();
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/v1/categories?limit=10" });
    expect(response.statusCode).toBe(200);
    expect(listPublicCategories).toHaveBeenCalledWith({ limit: 10 });
    await app.close();
  });

  it("rejects an unknown sales channel", async () => {
    const { deps, listPublicCategories } = createDeps();
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/v1/categories?salesChannel=bid" });
    expect(response.statusCode).toBe(400);
    expect(listPublicCategories).not.toHaveBeenCalled();
    await app.close();
  });
});
