import { describe, expect, it } from "vitest";
import { resolveAdminProxyTarget } from "./admin-proxy-policy";

describe("resolveAdminProxyTarget", () => {
  it("maps BFF admin paths to shop-api admin v1", () => {
    const resolved = resolveAdminProxyTarget({
      bffPath: "/api/admin/session",
      shopApiBaseUrl: "http://shop-api:3011",
    });
    expect(resolved?.upstreamUrl.pathname).toBe("/admin/v1/session");
    expect(resolved?.requiresRecentAuth).toBe(false);
  });

  it("flags finance routes for recent auth", () => {
    const resolved = resolveAdminProxyTarget({
      bffPath: "/api/admin/payouts/mark-paid",
      shopApiBaseUrl: "http://shop-api:3011",
    });
    expect(resolved?.requiresRecentAuth).toBe(true);
  });
});
