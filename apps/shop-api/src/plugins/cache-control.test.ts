import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../app.js";
import { createMinimalShopApiTestDeps } from "../test-app-deps.js";
import { isPublicCatalogueGetPath } from "./cache-control.js";

describe("isPublicCatalogueGetPath", () => {
  it("allows catalogue list and single-segment detail", () => {
    expect(isPublicCatalogueGetPath("/v1/artworks")).toBe(true);
    expect(isPublicCatalogueGetPath("/v1/artworks/reed-study")).toBe(true);
    expect(isPublicCatalogueGetPath("/v1/artists/foundation-artist")).toBe(true);
    expect(isPublicCatalogueGetPath("/v1/categories/prints")).toBe(true);
  });

  it("rejects nested sub-resources such as interest", () => {
    expect(isPublicCatalogueGetPath("/v1/artworks/reed-study/interest")).toBe(false);
    expect(isPublicCatalogueGetPath("/v1/artworks/a/b/c")).toBe(false);
  });
});

describe("registerPublicCatalogueCaching", () => {
  it("sets no-store on artwork interest GET", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/artworks/demo/interest",
      headers: { authorization: "Bearer test-bff-token-minimum-32-characters-long" },
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    await app.close();
  });

  it("sets public cache on catalogue list GET", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/v1/artworks" });
    expect(response.headers["cache-control"]).toContain("public");
    await app.close();
  });
});
