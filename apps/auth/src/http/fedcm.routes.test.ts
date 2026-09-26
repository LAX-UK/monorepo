import { Hono } from "hono";
import { afterEach, describe, expect, it } from "vitest";
import { registerFedcmRoutes } from "./fedcm.routes.js";

describe("FedCM routes", () => {
  const previous = process.env.FEDCM_ENABLED;

  afterEach(() => {
    process.env.FEDCM_ENABLED = previous;
  });

  it("does not register routes when disabled", async () => {
    process.env.FEDCM_ENABLED = "false";
    const app = new Hono();
    registerFedcmRoutes(app, {
      enabled: false,
      issuerOrigin: "https://auth.test",
    });
    const response = await app.request("/fedcm/config.json");
    expect(response.status).toBe(404);
  });

  it("serves config when enabled", async () => {
    const app = new Hono();
    registerFedcmRoutes(app, {
      enabled: true,
      issuerOrigin: "https://auth.test",
    });
    const response = await app.request("/fedcm/config.json");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { accounts_endpoint: string };
    expect(body.accounts_endpoint).toContain("/fedcm/accounts");
  });

  it("rejects accounts without webidentity fetch dest", async () => {
    const app = new Hono();
    registerFedcmRoutes(app, {
      enabled: true,
      issuerOrigin: "https://auth.test",
    });
    const response = await app.request("/fedcm/accounts");
    expect(response.status).toBe(403);
  });
});
