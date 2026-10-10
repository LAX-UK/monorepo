import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  type HostedAuthPageMountOptions,
  mountHostedAuthPages,
} from "./mount-hosted-auth-pages.js";

const capabilities: Omit<HostedAuthPageMountOptions, "getSession"> = {
  googleEnabled: false,
  appleEnabled: false,
  phoneEnabled: false,
  turnstileSiteKey: null,
  shopOrigin: "https://test-shop.lax.bid",
  shopAdminOrigin: "https://test-shop-admin.lax.bid",
  bidOrigin: "https://test.lax.bid",
  accountOrigin: "https://test-account.lax.bid",
  emailFirst: false,
  requireEmailVerification: true,
};

function appWithSession(session: unknown): Hono {
  const app = new Hono();
  mountHostedAuthPages(app, { ...capabilities, getSession: async () => session });
  return app;
}

const setupPath = "/two-factor/setup?client_id=lax-account-web";

describe("hosted two-factor setup page", () => {
  it("sends visitors without an issuer session to sign in for the same product", async () => {
    const response = await appWithSession(null).request(setupPath);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?client_id=lax-account-web");
  });

  it("never offers re-enrolment when an authenticator is already set up", async () => {
    const response = await appWithSession({ user: { twoFactorEnabled: true } }).request(setupPath);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Authenticator already set up");
    expect(html).not.toContain("setup-enable-btn");
    expect(html).toContain('href="https://test-account.lax.bid/api/auth/login"');
  });

  it("renders enrolment with customer copy for non-staff products", async () => {
    const response = await appWithSession({ user: { twoFactorEnabled: false } }).request(setupPath);
    const html = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("setup-enable-btn");
    expect(html).not.toContain("Shop admin and other staff tools");
  });

  it("keeps the staff explanation for shop-admin", async () => {
    const response = await appWithSession({ user: { twoFactorEnabled: false } }).request(
      "/two-factor/setup?client_id=lax-shop-admin",
    );
    expect(await response.text()).toContain("Shop admin and other staff tools");
  });
});
