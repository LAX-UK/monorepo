import { Hono } from "hono";
import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { parseAuthEnv } from "../env.js";
import { type CreateAuthAppOptions, createAuthApp } from "./create-auth-app.js";

function buildApp() {
  const internal = new Hono().post("/oauth/token", (c) => c.json({ internal: true }));
  const counter = { inc: vi.fn() };
  const auth = {
    handler: vi.fn(async () => Response.json({ handledBy: "issuer" })),
    api: {
      getJwks: vi.fn(async () => ({ keys: [{ kid: "kid-1" }] })),
      getSession: vi.fn(async () => null),
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
