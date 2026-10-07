import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

describe("merchandise routes", () => {
  it("lists public merchandise products when the feature flag is enabled", async () => {
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_MERCHANDISE_ENABLED: true,
      },
      merchandise: {
        listPublicMerchandiseProducts: async () => ({
          items: [
            { slug: "acceptance-test-cap", title: "Acceptance test cap", fromPricePence: 2500 },
          ],
        }),
        getPublicMerchandiseProduct: async (slug: string) =>
          slug === "acceptance-test-cap"
            ? {
                slug,
                title: "Acceptance test cap",
                description: "Test cap",
                variants: [
                  {
                    variantId: "550e8400-e29b-41d4-a716-446655440099",
                    sku: "CAP-001",
                    pricePence: 2500,
                    availableCount: 3,
                  },
                ],
              }
            : null,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/v1/merchandise/products" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [{ slug: "acceptance-test-cap", title: "Acceptance test cap", fromPricePence: 2500 }],
    });
    await app.close();
  });

  it("returns merchandise product detail by slug when enabled", async () => {
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_MERCHANDISE_ENABLED: true,
      },
      merchandise: {
        listPublicMerchandiseProducts: async () => ({ items: [] }),
        getPublicMerchandiseProduct: async () => ({
          slug: "acceptance-test-cap",
          title: "Acceptance test cap",
          description: null,
          variants: [],
        }),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/merchandise/products/acceptance-test-cap",
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("does not register public merchandise routes when SHOP_MERCHANDISE_ENABLED is false", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    expect(app.hasRoute({ method: "GET", url: "/v1/merchandise/products" })).toBe(false);
    await app.close();
  });
});
