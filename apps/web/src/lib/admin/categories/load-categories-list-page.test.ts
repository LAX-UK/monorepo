import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminCategoriesListPage } from "./load-categories-list-page";

const { fetchPage, getSummary, getTree } = vi.hoisted(() => ({
  fetchPage: vi.fn(),
  getSummary: vi.fn(),
  getTree: vi.fn(),
}));

vi.mock("@/lib/admin/admin-list-controllers", () => ({
  categoriesListController: {
    fetch: fetchPage,
  },
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminCategoriesListSummary: getSummary,
  getAdminCategoryList: getTree,
}));

describe("loadAdminCategoriesListPage", () => {
  beforeEach(() => {
    fetchPage.mockReset();
    getSummary.mockReset();
    getTree.mockReset();
    getSummary.mockResolvedValue({
      totalCount: 42,
      activeCount: 40,
      archivedCount: 2,
      usageTotals: { lots: 100, sales: 8, submissions: 12 },
    });
    getTree.mockResolvedValue([{ id: "root" }]);
  });

  it("returns paginated rows, global summary, and an independent full tree", async () => {
    fetchPage.mockResolvedValue({ rows: [{ id: "page-row" }], total: 42 });

    const result = await loadAdminCategoriesListPage({
      offset: 0,
      limit: 25,
      includeArchived: false,
    });

    expect(result.rows).toEqual([{ id: "page-row" }]);
    expect(result.total).toBe(42);
    expect(result.summary.usageTotals.lots).toBe(100);
    expect(result.categoryTree).toEqual([{ id: "root" }]);
    expect(result.listError).toBeNull();
  });
});
