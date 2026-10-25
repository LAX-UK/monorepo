import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminSalesListPage } from "./load-sales-list-page";

const { fetchSales, getSummary } = vi.hoisted(() => ({
  fetchSales: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock("@/lib/admin/admin-list-controllers", () => ({
  salesListController: {
    parseQuery: (sp: Record<string, string | undefined>) => ({
      q: sp.q,
      status: sp.status,
      lifecycle: sp.lifecycle,
      delivery: sp.delivery,
      limit: Number(sp.limit ?? 25),
      offset: Number(sp.offset ?? 0),
      sort: sp.sort,
    }),
    fetch: fetchSales,
  },
}));

vi.mock("@/lib/data/http/admin-sales-summary.server", () => ({
  EMPTY_ADMIN_SALES_LIST_SUMMARY: {
    activeCount: 0,
    upcomingCount: 0,
    draftCount: 0,
    completedCount: 0,
    avgLotsPerSale: 0,
    totalHammerValue: "0",
    lensCounts: { all: 0, upcoming: 0, live: 0, closed: 0, settled: 0, setup: 0 },
  },
  getAdminSalesListSummary: getSummary,
}));

describe("loadAdminSalesListPage", () => {
  beforeEach(() => {
    fetchSales.mockReset();
    getSummary.mockReset();
    getSummary.mockResolvedValue({
      activeCount: 0,
      upcomingCount: 0,
      draftCount: 0,
      completedCount: 0,
      avgLotsPerSale: 0,
      totalHammerValue: "0",
      lensCounts: { all: 0, upcoming: 0, live: 0, closed: 0, settled: 0, setup: 0 },
    });
  });

  it("contains list failures and returns a composition-ready empty model", async () => {
    fetchSales.mockRejectedValue(new Error("Sales unavailable"));

    const result = await loadAdminSalesListPage({ lens: "all", limit: "25", offset: "0" });

    expect(result.err).toBe("Sales unavailable");
    expect(result.boardRows).toEqual([]);
    expect(result.boardPagination).toBeNull();
  });
});
