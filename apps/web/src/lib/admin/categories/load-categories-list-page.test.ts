import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminCategoriesListPage } from "./load-categories-list-page";

const { fetchPage, getSummary } = vi.hoisted(() => ({
  fetchPage: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock("@/lib/admin/admin-list-controllers", () => ({
  categoriesListController: {
    fetch: fetchPage,
  },
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminCategoriesListSummary: getSummary,
}));

const query = { offset: 0, limit: 25, includeArchived: false };

describe("loadAdminCategoriesListPage", () => {
  beforeEach(() => {
    fetchPage.mockReset();
    getSummary.mockReset();
    getSummary.mockResolvedValue({
      totalCount: 42,
      activeCount: 40,
      archivedCount: 2,
      usageTotals: { lots: 100, sales: 8, submissions: 12 },
      mostUsedCategory: null,
    });
  });

  it("returns paginated rows and the global summary", async () => {
    fetchPage.mockResolvedValue({ rows: [{ id: "page-row" }], total: 42 });

    const result = await loadAdminCategoriesListPage(query);

    expect(result.rows).toEqual([{ id: "page-row" }]);
    expect(result.total).toBe(42);
    expect(result.summary?.usageTotals.lots).toBe(100);
    expect(result.listError).toBeNull();
  });

  it("leaves the summary out, rather than zeroing it, when it cannot load", async () => {
    fetchPage.mockResolvedValue({ rows: [], total: 0 });
    getSummary.mockRejectedValue(new Error("down"));

    const result = await loadAdminCategoriesListPage(query);

    expect(result.summary).toBeNull();
  });

  it("reports a list failure as a message", async () => {
    fetchPage.mockRejectedValue(new Error("Categories are unavailable"));

    const result = await loadAdminCategoriesListPage(query);

    expect(result.rows).toEqual([]);
    expect(result.listError).toBe("Categories are unavailable");
  });
});
