import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const TOKEN = "admin-token-placeholder-minimum-length";
const ID = "44444444-4444-4444-8444-444444444444";

/**
 * Routes open to every signed-in staff member, each answering only with what the person may see.
 * A route joins this list only with the reason it needs no capability of its own.
 */
const OPEN_TO_ANY_STAFF: Record<string, string> = {
  "GET /admin/v1/session": "The person's own roles and capabilities.",
  "GET /admin/v1/overview/kpis": "Each figure is gated by the capability for its list.",
  "GET /admin/v1/saved-views": "Each list key is checked against the capability for that list.",
  "POST /admin/v1/saved-views": "Each list key is checked against the capability for that list.",
  "PATCH /admin/v1/saved-views/:id": "Only the person's own views, checked per list.",
  "PUT /admin/v1/saved-views/order": "Only the person's own views, checked per list.",
  "DELETE /admin/v1/saved-views/:id": "Only the person's own views, checked per list.",
  "GET /admin/v1/home-features": "Read-only: the lists show only what the home pages already show.",
};

const HEALTH = new Set(["/admin/v1/health/live", "/admin/v1/health/ready"]);

type Route = { method: string; url: string };

/**
 * The whole admin app with every feature on, every request valid as far as the schemas go, and a
 * signed-in staff member who holds no capability at all.
 */
async function appWithNoCapabilities() {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: "nobody",
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const base = createMinimalShopApiTestDeps().env;
  const deps = createMinimalShopApiTestDeps({
    env: {
      ...base,
      SHOP_ADMIN_ENABLED: true,
      SHOP_EDITORIAL_ENABLED: true,
      SHOP_PAYOUTS_ENABLED: true,
      SHOP_THIRD_PARTY_ENABLED: true,
      SHOP_ORIGINALS_ENABLED: true,
      SHOP_MERCHANDISE_ENABLED: true,
      SHOP_PORTAL_OWNERSHIP_ENABLED: true,
    },
    staffReader: {
      findActiveByIdentitySubject: async (subject) => ({ roles: [], identitySubjectId: subject }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  const app = createShopApiApp({ deps, logger: false });
  // Schemas would refuse the empty probes first; the capability check is what is under test.
  app.setValidatorCompiler(() => () => true);
  const routes: Route[] = [];
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) {
      if (method === "HEAD" || method === "OPTIONS") continue;
      if (!route.url.startsWith("/admin/v1/") || HEALTH.has(route.url)) continue;
      routes.push({ method, url: route.url });
    }
  });
  await app.ready();
  return { app, routes };
}

describe("every LAX Admin route checks a capability", () => {
  it("refuses a staff member with no capability on every route not open to all staff", async () => {
    const { app, routes } = await appWithNoCapabilities();
    expect(routes.length).toBeGreaterThan(90);
    const unguarded: string[] = [];
    for (const route of routes) {
      const key = `${route.method} ${route.url}`;
      if (key in OPEN_TO_ANY_STAFF) continue;
      const response = await app.inject({
        method: route.method as "GET",
        url: route.url.replace(/:[A-Za-z]+/g, ID),
        headers: { authorization: `Bearer ${TOKEN}`, "idempotency-key": ID },
        ...(route.method === "GET" || route.method === "DELETE" ? {} : { payload: {} }),
      });
      if (response.statusCode !== 403) unguarded.push(`${key} answered ${response.statusCode}`);
    }
    await app.close();
    expect(unguarded).toEqual([]);
  }, 60_000);

  it("keeps the open list to routes that exist", async () => {
    const { app, routes } = await appWithNoCapabilities();
    await app.close();
    const keys = new Set(routes.map((r) => `${r.method} ${r.url}`));
    for (const route of Object.keys(OPEN_TO_ANY_STAFF)) expect(keys.has(route), route).toBe(true);
  });
});
