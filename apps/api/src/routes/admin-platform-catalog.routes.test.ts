import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { requireVenuesAccess } from "../middleware/require-capability.js";

function createPlatformCatalogRouteApp(
  staffRole: string | null,
  resolvePlatformCatalogLegalEntityId: () => Promise<string | null>,
) {
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-user-id");
    c.set("userRole", "staff");
    c.set("userStaffRole", staffRole);
    await next();
  });
  app.get("/admin/platform-catalog/legal-entity-id", requireVenuesAccess, async (c) => {
    const id = await resolvePlatformCatalogLegalEntityId();
    return c.json({ data: { id } });
  });
  return app;
}

describe("GET /admin/platform-catalog/legal-entity-id", () => {
  it("returns 403 for staff_viewer", async () => {
    const app = createPlatformCatalogRouteApp("staff_viewer", vi.fn());
    const res = await app.request("http://test/admin/platform-catalog/legal-entity-id");
    expect(res.status).toBe(403);
  });

  it("returns resolved id for catalogue_manager", async () => {
    const resolvePlatformCatalogLegalEntityId = vi
      .fn()
      .mockResolvedValue("30000000-0000-4000-9000-000000000001");
    const app = createPlatformCatalogRouteApp(
      "catalogue_manager",
      resolvePlatformCatalogLegalEntityId,
    );
    const res = await app.request("http://test/admin/platform-catalog/legal-entity-id");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { id: "30000000-0000-4000-9000-000000000001" },
    });
    expect(resolvePlatformCatalogLegalEntityId).toHaveBeenCalledOnce();
  });
});
