import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../app.js";
import { createMinimalShopApiTestDeps } from "../test-app-deps.js";

describe("health routes", () => {
  it("keeps live health process-only", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        health: {
          checkConnectivity: async () => {
            throw new Error("db down");
          },
          checkCatalogueSchema: async () => undefined,
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: "shop-api", status: "ok" });
    await app.close();
  });

  it("returns degraded when connectivity fails", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        health: {
          checkConnectivity: async () => {
            throw new Error("db down");
          },
          checkCatalogueSchema: async () => undefined,
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      service: "shop-api",
      status: "degraded",
      database: "unavailable",
    });
    await app.close();
  });

  it("returns degraded when catalogue schema is missing", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        health: {
          checkConnectivity: async () => undefined,
          checkCatalogueSchema: async () => {
            throw new Error("missing column");
          },
        },
      }),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      service: "shop-api",
      status: "degraded",
      catalogueSchema: "missing",
    });
    await app.close();
  });

  it("returns ok when connectivity and schema checks pass", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps(),
      logger: false,
    });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/health/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      service: "shop-api",
      status: "ok",
      database: "ok",
      catalogueSchema: "ok",
    });
    await app.close();
  });
});
