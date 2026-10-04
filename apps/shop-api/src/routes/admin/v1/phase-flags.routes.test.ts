import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

function phaseGatedAdminDeps() {
  return createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_ADMIN_ENABLED: true,
      SHOP_PAYOUTS_ENABLED: false,
      SHOP_THIRD_PARTY_ENABLED: false,
      SHOP_ORIGINALS_ENABLED: false,
      SHOP_MERCHANDISE_ENABLED: false,
    },
  });
}

describe("admin phase feature flags", () => {
  it("returns 404 for Phase 2 admin routes when SHOP_PAYOUTS_ENABLED is false", async () => {
    const app = createShopApiApp({ deps: phaseGatedAdminDeps(), logger: false });
    await app.ready();
    const routes: Array<{ method: "POST" | "PATCH"; url: string }> = [
      { method: "POST", url: "/admin/v1/production/tasks" },
      { method: "PATCH", url: "/admin/v1/fulfilment" },
      { method: "POST", url: "/admin/v1/fulfilment/possession" },
      { method: "POST", url: "/admin/v1/cancellations" },
      { method: "POST", url: "/admin/v1/refunds" },
      { method: "POST", url: "/admin/v1/payouts/mark-paid" },
    ];
    for (const { method, url } of routes) {
      const response = await app.inject({ method, url, payload: {} });
      expect(response.statusCode, url).toBe(404);
    }
    await app.close();
  });

  it("returns 404 for Phase 3 admin routes when SHOP_THIRD_PARTY_ENABLED is false", async () => {
    const app = createShopApiApp({ deps: phaseGatedAdminDeps(), logger: false });
    await app.ready();
    const routes: Array<{ method: "POST"; url: string }> = [
      { method: "POST", url: "/admin/v1/holds" },
      { method: "POST", url: "/admin/v1/holds/00000000-0000-4000-8000-000000000099/release" },
      { method: "POST", url: "/admin/v1/third-party-sales" },
      {
        method: "POST",
        url: "/admin/v1/sale-fees/00000000-0000-4000-8000-000000000088/approve",
      },
    ];
    for (const { method, url } of routes) {
      const response = await app.inject({ method, url, payload: {} });
      expect(response.statusCode, url).toBe(404);
    }
    await app.close();
  });

  it("returns 404 for Phase 4 original-sale routes when SHOP_ORIGINALS_ENABLED is false", async () => {
    const app = createShopApiApp({ deps: phaseGatedAdminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/original-sales",
      payload: {},
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("returns 404 for Phase 4 merchandise routes when SHOP_MERCHANDISE_ENABLED is false", async () => {
    const app = createShopApiApp({ deps: phaseGatedAdminDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/merchandise/products",
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
