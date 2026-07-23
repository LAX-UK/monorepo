import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { AdminCatalogRoutesContainer } from "../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./admin/_shared.js";
import { attachAdminCatalogRoutes } from "./admin/catalog.routes.js";

function createApp(catalog: AdminCatalogRoutesContainer["admin"]["catalog"]) {
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-user");
    c.set("userRole", "staff");
    c.set("userStaffRole", "catalogue_manager");
    await next();
  });
  attachAdminCatalogRoutes(
    app as unknown as AdminHono,
    {
      admin: {
        catalog,
        requestLifecycle: { isSuspended: vi.fn(), reconcileAdminRequestCookie: vi.fn() },
      },
    } as unknown as AdminCatalogRoutesContainer,
  );
  return app;
}

describe("admin category list routes", () => {
  it("forwards pagination and search to the category page service", async () => {
    const listCategoryPageForAdmin = vi.fn().mockResolvedValue({ rows: [], total: 0 });
    const app = createApp({ listCategoryPageForAdmin } as never);

    const response = await app.request(
      "http://test/categories/page?q=paint&limit=25&offset=50&includeArchived=true",
    );

    expect(response.status).toBe(200);
    expect(listCategoryPageForAdmin).toHaveBeenCalledWith({
      includeArchived: true,
      q: "paint",
      limit: 25,
      offset: 50,
    });
  });

  it("returns the global summary for the selected archive lens", async () => {
    const getCategoriesListSummary = vi.fn().mockResolvedValue({
      totalCount: 2,
      activeCount: 10,
      archivedCount: 2,
      usageTotals: { lots: 4, sales: 1, submissions: 3 },
    });
    const app = createApp({ getCategoriesListSummary } as never);

    const response = await app.request("http://test/categories/summary?includeArchived=true");

    expect(response.status).toBe(200);
    expect(getCategoriesListSummary).toHaveBeenCalledWith({ includeArchived: true });
  });
});
