import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/shop-identity.server", () => ({
  SHOP_IDENTITY_SESSION_COOKIE: "shop_identity_session",
  SHOP_IDENTITY_FETCH_TIMEOUT_MS: 1000,
  shopIdentityBaseUrl: () => "https://shop-identity.example",
  shopIdentityServerUrl: (path: string) => `https://shop-identity.example${path}`,
}));

const { middleware } = await import("./middleware.js");

const KEYS = ["SHOP_EXPRESS_CHECKOUT", "SILENT_SSO_ENABLED", "IDENTITY_PUBLIC_BASE_URL"] as const;

async function policyFor(path: string): Promise<string | null> {
  const response = await middleware(new NextRequest(`http://localhost:3020${path}`));
  return response.headers.get("content-security-policy");
}

describe("shop middleware express checkout headers", () => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

  beforeEach(() => {
    process.env.SILENT_SSO_ENABLED = "false";
    process.env.IDENTITY_PUBLIC_BASE_URL = "https://identity.example";
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = saved[key];
    }
  });

  it("sends no policy on any page while the flag is unset or off", async () => {
    Reflect.deleteProperty(process.env, "SHOP_EXPRESS_CHECKOUT");
    expect(await policyFor("/basket")).toBeNull();
    expect(await policyFor("/checkout")).toBeNull();
    process.env.SHOP_EXPRESS_CHECKOUT = "false";
    expect(await policyFor("/basket")).toBeNull();
    expect(await policyFor("/checkout")).toBeNull();
  });

  it("allows Stripe.js on the basket and Details only when the flag is on", async () => {
    process.env.SHOP_EXPRESS_CHECKOUT = "true";
    for (const path of ["/basket", "/checkout"]) {
      const policy = (await policyFor(path)) ?? "";
      expect(policy).toContain("https://js.stripe.com");
      expect(policy).toContain("https://hooks.stripe.com");
      expect(policy).toContain(
        "connect-src 'self' https://identity.example https://shop-identity.example https://api.stripe.com",
      );
    }
    for (const path of ["/", "/checkout/confirmation", "/checkout/cancel", "/artworks/x"]) {
      expect(await policyFor(path)).toBeNull();
    }
  });

  it("rejects a flag value that is not true or false", async () => {
    process.env.SHOP_EXPRESS_CHECKOUT = "yes";
    await expect(policyFor("/basket")).rejects.toThrow();
  });
});
