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
  artOrigin: "https://test-art.lax.bid",
  shopAdminOrigin: "https://test-shop-admin.lax.bid",
  bidOrigin: "https://test.lax.bid",
  accountOrigin: "https://test-account.lax.bid",
  emailFirst: false,
  requireEmailVerification: true,
};

function appWithSession(
  session: unknown,
  requirement: Awaited<
    ReturnType<NonNullable<HostedAuthPageMountOptions["readTwoFactorRequirement"]>>
  > = { required: false, sources: [] },
): Hono {
  const app = new Hono();
  mountHostedAuthPages(app, {
    ...capabilities,
    getSession: async () => session,
    readTwoFactorRequirement: async () => requirement,
  });
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
    const response = await appWithSession({ user: { id: "u1", twoFactorEnabled: true } }).request(
      `${setupPath}&required_by=staff`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/two-factor/manage?client_id=lax-account-web");
  });

  it("renders enrolment with customer copy for non-staff products", async () => {
    const response = await appWithSession({ user: { twoFactorEnabled: false } }).request(setupPath);
    const html = await response.text();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("setup-enable-btn");
    expect(html).not.toContain("LAX Shop Admin and other staff tools");
  });

  it("keeps the staff explanation for shop-admin", async () => {
    const response = await appWithSession({ user: { twoFactorEnabled: false } }).request(
      "/two-factor/setup?client_id=lax-shop-admin",
    );
    expect(await response.text()).toContain("LAX Shop Admin and other staff tools");
  });
});

const managePath = "/two-factor/manage?client_id=lax-account-web";

describe("hosted two-factor manage page", () => {
  it("offers turning it off when no policy requires it", async () => {
    const response = await appWithSession({ user: { id: "u1", twoFactorEnabled: true } }).request(
      managePath,
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("manage-disable");
    expect(html).not.toContain("setup-enable-btn");
    expect(html).toContain('href="https://test-account.lax.bid/api/auth/login"');
  });

  it("explains the requirement and hides turn off while a policy applies", async () => {
    const response = await appWithSession(
      { user: { id: "u1", twoFactorEnabled: true } },
      { required: true, sources: [{ scope: "org", legalEntityId: "e1" }, { scope: "staff" }] },
    ).request(managePath);
    const html = await response.text();
    expect(html).toContain("Required by LAX staff policy and your organisation");
    expect(html).not.toContain("manage-disable");
  });

  it("sends accounts without an authenticator to setup", async () => {
    const response = await appWithSession({ user: { id: "u1", twoFactorEnabled: false } }).request(
      managePath,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/two-factor/setup?client_id=lax-account-web");
  });

  it("sends visitors without a session to sign in", async () => {
    const response = await appWithSession(null).request(managePath);
    expect(response.headers.get("location")).toBe("/login?client_id=lax-account-web");
  });
});

describe("two-step help page", () => {
  it("is reachable without a session, because the person cannot finish signing in", async () => {
    const response = await appWithSession(null).request(
      "/two-factor/help?client_id=lax-account-web",
    );
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("Contact support");
    expect(html).toContain('href="/two-factor?client_id=lax-account-web"');
  });
});

describe("account chooser for an explicit sign-in or sign-up visit", () => {
  const session = { user: { id: "u1", name: "Jane Doe", email: "jane.doe@example.test" } };
  const signIn = "/login?client_id=lax-shop-web";
  const signUp = "/sign-up?client_id=lax-shop-web";

  it("asks before signing in a browser that already holds an issuer session", async () => {
    const response = await appWithSession(session).request(signIn);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(html).toContain("You&#39;re signed in as Jane Doe (j***@example.test).");
    expect(html).not.toContain("jane.doe@example.test");
    expect(html).toContain('href="https://test-shop.lax.bid/login"');
    expect(html).toContain("Use a different account");
    expect(html).toContain('data-intent="sign-in"');
    expect(html).toContain('data-switch-href="/login?client_id=lax-shop-web"');
  });

  it("does the same on the sign-up page and returns to it after signing out", async () => {
    const html = await (await appWithSession(session).request(signUp)).text();
    expect(html).toContain('data-intent="sign-up"');
    expect(html).toContain('data-switch-href="/sign-up?client_id=lax-shop-web"');
  });

  it("shows the real form when nobody is signed in", async () => {
    const html = await (await appWithSession(null).request(signIn)).text();
    expect(html).not.toContain("account-chooser");
    expect(html).toContain("login-form");
  });

  it("leaves an authorize request that needs a sign-in on the real form", async () => {
    const authorize =
      "/login?response_type=code&client_id=lax-shop-web&redirect_uri=https://test-shop.lax.bid/auth/callback&scope=openid&state=abc&nonce=n&code_challenge=c&code_challenge_method=S256&prompt=login";
    const html = await (await appWithSession(session).request(authorize)).text();
    expect(html).not.toContain("account-chooser");
    expect(html).toContain("login-form");
  });

  it("leaves a sign-in that Better Auth already started on the real form", async () => {
    const response = await appWithSession(session).request(signIn, {
      headers: { cookie: "oidc_login_prompt=abc" },
    });
    expect(await response.text()).not.toContain("account-chooser");
  });

  it("falls back to the real form when the session has no address to show", async () => {
    const html = await (await appWithSession({ user: { id: "u1" } }).request(signIn)).text();
    expect(html).not.toContain("account-chooser");
  });

  it("falls back to the real form when the session cannot be read", async () => {
    const app = new Hono();
    mountHostedAuthPages(app, {
      ...capabilities,
      getSession: async () => {
        throw new Error("down");
      },
    });
    expect(await (await app.request(signIn)).text()).not.toContain("account-chooser");
  });
});
