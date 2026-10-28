import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { requireVenuesAccess } from "../middleware/require-capability.js";

function createPlatformCatalogRouteApp(
  staffRoles: StaffRoles | undefined,
  resolvePlatformCatalogLegalEntityId: () => Promise<string | null>,
) {
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-user-id");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  app.get("/admin/platform-catalog/legal-entity-id", requireVenuesAccess, async (c) => {
    const id = await resolvePlatformCatalogLegalEntityId();
    return c.json({ data: { id } });
  });
  return app;
}

describe("GET /admin/platform-catalog/legal-entity-id", () => {
  it("returns 403 for read_only", async () => {
    const app = createPlatformCatalogRouteApp(["read_only"], vi.fn());
    const res = await app.request("http://test/admin/platform-catalog/legal-entity-id");
    expect(res.status).toBe(403);
  });

  it("returns resolved id for cataloguer", async () => {
    const resolvePlatformCatalogLegalEntityId = vi
      .fn()
      .mockResolvedValue("30000000-0000-4000-9000-000000000001");
    const app = createPlatformCatalogRouteApp(["cataloguer"], resolvePlatformCatalogLegalEntityId);
    const res = await app.request("http://test/admin/platform-catalog/legal-entity-id");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: { id: "30000000-0000-4000-9000-000000000001" },
    });
    expect(resolvePlatformCatalogLegalEntityId).toHaveBeenCalledOnce();
  });
});
