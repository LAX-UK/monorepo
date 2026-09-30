import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shop-identity.server", () => ({
  SHOP_IDENTITY_SESSION_COOKIE: "shop_identity_session",
  SHOP_IDENTITY_FETCH_TIMEOUT_MS: 1000,
  shopIdentityBaseUrl: () => "http://localhost:3010",
  shopIdentityServerUrl: (path: string) => `http://localhost:3010${path}`,
}));

const { middleware } = await import("./middleware.js");

describe("shop middleware silent SSO", () => {
  const prev = process.env.SILENT_SSO_ENABLED;

  afterEach(() => {
    process.env.SILENT_SSO_ENABLED = prev;
    vi.restoreAllMocks();
  });

  it("redirects token upgrade when refresh token is missing", async () => {
    process.env.SILENT_SSO_ENABLED = "false";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authenticated: true, tokenUpgradeRequired: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const request = new NextRequest("http://localhost:3020/checkout", {
      headers: {
        cookie: "shop_identity_session=abcdefghijklmnopqrstuvwxyz0123456789ABCD",
      },
    });
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/upgrade");
  });

  it("redirects guests to sso-probe when enabled", async () => {
    process.env.SILENT_SSO_ENABLED = "true";
    const request = new NextRequest("http://localhost:3020/catalog", {
      headers: {
        "sec-fetch-mode": "navigate",
        "sec-fetch-dest": "document",
        "user-agent": "Mozilla/5.0",
      },
    });
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/sso-probe?returnTo=");
  });
});
