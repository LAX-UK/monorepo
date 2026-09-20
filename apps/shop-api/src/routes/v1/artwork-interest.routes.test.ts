import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

describe("artwork interest routes", () => {
  it("requires auth for interest registration", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps(),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("rejects BFF-only tokens because interest requires a user subject", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps(),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/v1/artworks/test-slug/interest",
      headers: {
        authorization: "Bearer test-bff-token-minimum-32-characters-long",
      },
      payload: {},
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
