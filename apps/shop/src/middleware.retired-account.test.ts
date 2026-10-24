import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shop-identity.server", () => ({
  SHOP_IDENTITY_SESSION_COOKIE: "shop_identity_session",
  SHOP_IDENTITY_FETCH_TIMEOUT_MS: 1000,
  shopIdentityBaseUrl: () => "http://localhost:3010",
  shopIdentityServerUrl: (path: string) => `http://localhost:3010${path}`,
}));

const { middleware } = await import("./middleware.js");

describe("shop middleware retired account pages", () => {
  it.each([
    ["/account/sale-limits", "http://localhost:3040/account/selling/editions"],
    ["/account/sales", "http://localhost:3040/account/selling/sales"],
    ["/account/payouts", "http://localhost:3040/account/selling/payouts"],
    ["/account/artworks", "http://localhost:3040/account/selling/artworks"],
    ["/account/artist-sales", "http://localhost:3040/account/selling/artworks"],
  ])("answers %s with a permanent redirect to LAX Account", async (path, destination) => {
    const response = await middleware(new NextRequest(`http://localhost:3020${path}`));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(destination);
  });
});
