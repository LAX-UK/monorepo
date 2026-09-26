import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { parseAuthEnv } from "../env.js";
import { type CreateAuthAppOptions, createAuthApp } from "./create-auth-app.js";

function buildApp(session: unknown = null, getSessionImpl?: () => Promise<unknown>) {
  const internal = new Hono().post("/oauth/token", (c) => c.json({ internal: true }));
  const counter = { inc: vi.fn() };
  const auth = {
    handler: vi.fn(async () => Response.json({ handledBy: "issuer" })),
    api: {
      getJwks: vi.fn(async () => ({ keys: [{ kid: "kid-1" }] })),
      getSession: vi.fn(getSessionImpl ?? (async () => session)),
    },
  };
  const env = parseAuthEnv({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://localhost/auction",
    BETTER_AUTH_SECRET: "development-secret",
    OIDC_ISSUER_URL: "https://auth.test",
    WEB_ORIGIN: "https://web.test",
  });
  const app = createAuthApp({
    log: pino({ enabled: false }),
    issuerHttpOutcomes: counter,
    operational: {
      db: { execute: vi.fn(async () => ({ rows: [] })) },
      auth,
      nodeEnv: "test",
      metrics: { metrics: vi.fn(async () => "# metrics") },
      internal: {
        redis: {} as CreateAuthAppOptions["oidc"]["redis"],
        routes: internal,
      },
    },
    oidc: {
      env,
      db: {} as CreateAuthAppOptions["oidc"]["db"],
      redis: {} as CreateAuthAppOptions["oidc"]["redis"],
      auth,
      webOrigins: ["https://web.test"],
      refreshFamilies: {
        findAndPrepare: vi.fn(async () => null),
        completeRotation: vi.fn(async () => undefined),
        revokeFamily: vi.fn(async () => undefined),
      },
      replay: {
        reserve: vi.fn(async () => true),
        get: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
      },
      services: {
        oidc: {
          sessions: {},
          logout: {
            revokeIdentitySessions: vi.fn(),
            revokeSubject: vi.fn(),
            revokeClientSubject: vi.fn(),
          },
          logoutDelivery: {},
          confidentialClients: { authenticate: vi.fn(async () => null) },
          tokenManagement: {},
          tokenExchange: {},
        },
        ssf: { streams: {}, delivery: {} },
      } as unknown as CreateAuthAppOptions["oidc"]["services"],
      authHandler: vi.fn(async () => Response.json({ handledBy: "issuer" })),
      metrics: { refreshRotationOutcomes: counter, tokenExchangeOutcomes: counter },
    },
  } as unknown as CreateAuthAppOptions);
  return app;
}

describe("auth HTTP app composition", () => {
  it("mounts operational, discovery, protocol, and internal routes", async () => {
    const app = buildApp();
    await expect((await app.request("/health/live")).json()).resolves.toMatchObject({
      service: "auction-auth",
      status: "ok",
    });
    const paths = app.routes.map((route) => route.path);
    expect(paths).toContain("/.well-known/openid-configuration");
    expect(paths).toContain("/.well-known/ssf-configuration");
    expect(paths).toContain("/ssf/stream");
    expect(paths).toContain("/internal/oauth/token");
    expect(paths).toContain("/api/auth/oauth2/endsession");
    expect(paths).toContain("/login");
    expect(paths).toContain("/magic-link");
    expect(paths).toContain("/hosted-auth.css");
    expect(paths).toContain("/hosted-auth-runtime.js");
    expect(paths).toContain("/hosted-auth/lax-shop-logo.svg");
    expect(paths).toContain("/hosted-auth/lax-bid-logo.svg");
  });

  it("renders Shop branding for a validated Shop authorization query", async () => {
    const app = buildApp();
    const query =
      "response_type=code&client_id=lax-shop-web&redirect_uri=http://localhost:3010/auth/callback&scope=openid&state=abc&nonce=def&code_challenge=challenge&code_challenge_method=S256";
    const response = await app.request(`https://auth.test/login?${query}`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("theme-shop");
    expect(html).toContain("/hosted-auth/lax-shop-logo.svg");
    expect(html).toContain("Sign in");
    expect(html).toContain("field-control");
    expect(html).toContain("btn btn-primary");
    expect(html).toContain('data-email-first="true"');
    expect(html).toContain("client_id=lax-shop-web");
    expect(html).not.toMatch(/href="\/[^"]*code_challenge/);
    expect(html).not.toContain("challenges.cloudflare.com");
    expect(html).not.toContain('params.get("callbackURL")');
  });

  it("renders Bid branding for lax-bid-web login", async () => {
    const app = buildApp();
    const response = await app.request("https://auth.test/login?client_id=lax-bid-web");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("theme-bid");
    expect(html).toContain("/hosted-auth/lax-bid-logo.svg");
    expect(html).toContain("Back to LAX Bid");
  });

  it("serves the Bid hosted logo asset", async () => {
    const app = buildApp();
    const response = await app.request("https://auth.test/hosted-auth/lax-bid-logo.svg");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
  });

  it("redirects prompt=create login requests to hosted sign-up", async () => {
    const app = buildApp();
    const response = await app.request(
      "https://auth.test/login?client_id=lax-bid-web&prompt=create",
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/sign-up?client_id=lax-bid-web&prompt=create");
  });

  it("skips signed-in restart redirect when oidc_login_prompt cookie is present", async () => {
    const app = buildApp({ session: { id: "s1" }, user: { id: "u1" } });
    const response = await app.request("https://auth.test/login?client_id=lax-shop-web", {
      headers: { cookie: "oidc_login_prompt=signed-value" },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Sign in");
  });

  it("redirects a live session with only a product hint to the Shop restart URL", async () => {
    const app = buildApp({ session: { id: "s1" }, user: { id: "u1" } });
    const login = await app.request("https://auth.test/login?client_id=lax-shop-web");
    expect(login.status).toBe(302);
    expect(login.headers.get("location")).toBe("http://localhost:3020/login");
    const signUp = await app.request("https://auth.test/sign-up?client_id=lax-shop-web");
    expect(signUp.status).toBe(302);
    expect(signUp.headers.get("location")).toBe("http://localhost:3020/login");
  });

  it("still renders the login form when a session accompanies a resumable authorize query", async () => {
    const app = buildApp({ session: { id: "s1" }, user: { id: "u1" } });
    const query =
      "response_type=code&client_id=lax-shop-web&redirect_uri=http://localhost:3010/auth/callback&scope=openid&state=abc&nonce=def&code_challenge=challenge&code_challenge_method=S256";
    const response = await app.request(`https://auth.test/login?${query}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Sign in");
  });

  it("fails open and renders login when session lookup throws", async () => {
    const app = buildApp(null, async () => {
      throw new Error("session store down");
    });
    const response = await app.request("https://auth.test/login?client_id=lax-shop-web");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Sign in");
  });

  it("serves scoped hosted CSS without global button or boxed input rules", async () => {
    const app = buildApp();
    const response = await app.request("https://auth.test/hosted-auth.css");
    expect(response.status).toBe(200);
    const css = await response.text();
    expect(css).toContain("--auth-column: 528px");
    expect(css).toContain(".field-control");
    expect(css).toContain(".btn-reveal");
    expect(css).toContain("border-bottom: 1px solid var(--color-input-border)");
    expect(css).toContain(".field-input:focus + .field-label");
    expect(css).toContain(".field-input:-webkit-autofill");
    expect(css).not.toContain("input:not([type=");
    expect(css).not.toContain("button {");
  });

  it("registers token parsing before refresh and exchange, and internal routes before catch-all", () => {
    const routes = buildApp().routes;
    const parser = routes.findIndex(
      (route) => route.method === "ALL" && route.path === "/api/auth/oauth2/token",
    );
    const refresh = routes.findIndex(
      (route, index) => index > parser && route.method === "ALL" && route.path === "/api/auth/*",
    );
    const exchange = routes.findIndex(
      (route) => route.method === "POST" && route.path === "/api/auth/oauth2/token",
    );
    const internal = routes.findIndex((route) => route.path === "/internal/oauth/token");
    const reverseCatchAll = [...routes]
      .reverse()
      .findIndex((route) => route.method === "ALL" && route.path === "/api/auth/*");
    const catchAll = routes.length - reverseCatchAll - 1;
    expect(parser).toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(parser);
    expect(exchange).toBeGreaterThan(refresh);
    expect(internal).toBeLessThan(catchAll);
  });
});
