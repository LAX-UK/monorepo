import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { DANGEROUS_STAFF_ACTIONS } from "./dangerous-staff-actions.js";
import { STEP_UP_GUARD } from "./require-recent-staff-auth.js";

/**
 * The registry is only worth anything if it matches the real route table. This builds the real
 * api app (every dependency is an inert stand-in; nothing is called) and reads the routes Hono
 * registered.
 */
function inert(): never {
  const target = function inertTarget() {};
  return new Proxy(target, {
    get: (_t, key) => (key === "then" ? undefined : inert()),
    apply: () => inert(),
  }) as never;
}

const env = {
  LOG_LEVEL: "silent",
  NODE_ENV: "test",
  WEB_ORIGIN: "http://localhost",
  REDIS_URL: "redis://localhost",
  OIDC_ISSUER_URL: "http://idp.localhost",
};
const base = inert() as Record<string, unknown>;
const container = new Proxy(base, {
  get: (target, key) => (key === "env" ? env : target[key as string]),
});
const app = createApp(
  container as never,
  env as never,
  { getSessionUser: async () => null } as never,
);

const routes = app.routes;
const norm = (path: string) => path.replace(/:[A-Za-z]+/g, ":p");

/** Every handler registered for exactly this method and path, in registration order. */
const handlersFor = (method: string, path: string) =>
  routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => route.method === method && norm(route.path) === norm(path));

const isGuard = (handler: unknown) =>
  typeof handler === "function" &&
  (handler as unknown as Record<symbol, unknown>)[STEP_UP_GUARD] === true;

describe("dangerous staff action registry against the real route table", () => {
  it("resolves every entry to exactly one declared route and method", () => {
    for (const action of DANGEROUS_STAFF_ACTIONS) {
      const declared = new Set(
        routes
          .filter((route) => route.method === action.method && !route.path.includes("*"))
          .map((route) => `${route.method} ${norm(route.path)}`)
          .filter((key) => key === `${action.method} ${norm(action.path)}`),
      );
      expect(declared.size, `${action.id}: ${action.method} ${action.path}`).toBe(1);
    }
  });

  it("gives every entry marked 'route' a step-up guard ahead of the final handler", () => {
    const routeEntries = DANGEROUS_STAFF_ACTIONS.filter((action) => action.enforcedBy === "route");
    expect(routeEntries.length).toBeGreaterThan(0);
    for (const action of routeEntries) {
      const chain = handlersFor(action.method, action.path);
      const last = chain[chain.length - 1];
      expect(last, action.id).toBeDefined();
      const guardIndex = chain.findIndex(({ route }) => isGuard(route.handler));
      expect(guardIndex, `${action.id} has no step-up guard`).toBeGreaterThanOrEqual(0);
      expect(guardIndex, `${action.id} guard runs after the handler`).toBeLessThan(
        chain.length - 1,
      );
    }
  });

  it("mounts the registry gate on /admin ahead of every entry marked 'gate'", () => {
    const gate = routes.findIndex((route) => route.path === "/admin/*" && isGuard(route.handler));
    expect(gate).toBeGreaterThanOrEqual(0);
    for (const action of DANGEROUS_STAFF_ACTIONS.filter((x) => x.enforcedBy === "gate")) {
      const first = handlersFor(action.method, action.path)[0];
      expect(first, action.id).toBeDefined();
      expect(first?.index, `${action.id} is registered before the gate`).toBeGreaterThan(gate);
    }
  });
});
