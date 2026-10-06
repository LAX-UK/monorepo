import { describe, expect, it } from "vitest";
import { resolveAdminProxyTarget } from "./admin-proxy-policy";

describe("resolveAdminProxyTarget", () => {
  it("maps BFF admin paths to shop-api admin v1", () => {
    const resolved = resolveAdminProxyTarget({
      bffPath: "/api/admin/session",
      shopApiBaseUrl: "http://shop-api:3011",
      method: "GET",
    });
    expect(resolved?.upstreamUrl.pathname).toBe("/admin/v1/session");
    expect(resolved?.requiresRecentAuth).toBe(false);
  });

  it("flags finance mutations for recent auth but not GET reads", () => {
    const read = resolveAdminProxyTarget({
      bffPath: "/api/admin/payouts",
      shopApiBaseUrl: "http://shop-api:3011",
      method: "GET",
    });
    expect(read?.requiresRecentAuth).toBe(false);

    const write = resolveAdminProxyTarget({
      bffPath: "/api/admin/payouts/mark-paid",
      shopApiBaseUrl: "http://shop-api:3011",
      method: "POST",
    });
    expect(write?.requiresRecentAuth).toBe(true);
  });

  it("rejects path traversal segments", () => {
    expect(
      resolveAdminProxyTarget({
        bffPath: "/api/admin/clients/../session",
        shopApiBaseUrl: "http://shop-api:3011",
        method: "GET",
      }),
    ).toBeNull();
    expect(
      resolveAdminProxyTarget({
        bffPath: "/api/admin/clients/%2e%2e/session",
        shopApiBaseUrl: "http://shop-api:3011",
        method: "GET",
      }),
    ).toBeNull();
    expect(
      resolveAdminProxyTarget({
        bffPath: "/api/admin/clients/%252e%252e/session",
        shopApiBaseUrl: "http://shop-api:3011",
        method: "GET",
      }),
    ).toBeNull();
  });
});
