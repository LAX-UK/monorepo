import type { Hono } from "hono";
import type { ShopIdentityAppDeps } from "../shop-identity-app-deps.js";

export function registerHealthRoutes(app: Hono, deps: ShopIdentityAppDeps): void {
  const { release } = deps;

  app.get("/health/live", (c) => c.json({ service: "shop-identity", status: "ok" }));
  app.get("/health/ready", async (c) => {
    try {
      await deps.checkDatabase();
      return c.json({
        service: "shop-identity",
        status: "ok",
        release,
        database: "ok",
      });
    } catch {
      return c.json({ service: "shop-identity", status: "degraded", release }, 503);
    }
  });
  for (const path of ["/health/deps", "/api/health/deps"] as const) {
    app.get(path, async (c) => {
      try {
        await deps.checkIdentityProvider();
        return c.json({
          service: "shop-identity",
          status: "ok",
          release,
          identity: "ok",
        });
      } catch {
        return c.json(
          { service: "shop-identity", status: "degraded", release, identity: "unavailable" },
          503,
        );
      }
    });
  }
}
