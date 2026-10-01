import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const bffHeaders = {
  authorization: "Bearer test-bff-token-minimum-32-characters-long",
};

describe("portal me routes", () => {
  it("returns feature_disabled when portal ownership is off", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/editions",
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "shop.feature_disabled" });
    await app.close();
  });

  it("rejects BFF tokens on portal me routes (user subject required)", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        env: {
          ...createMinimalShopApiTestDeps().env,
          SHOP_PORTAL_OWNERSHIP_ENABLED: true,
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/editions",
      headers: bffHeaders,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
