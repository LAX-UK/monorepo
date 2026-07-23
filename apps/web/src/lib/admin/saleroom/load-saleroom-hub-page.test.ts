import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/saleroom-hub-controller", () => ({
  saleroomHubController: {
    fetch: vi.fn().mockResolvedValue({
      rows: [],
      summary: { liveCount: 0, scheduledCount: 0, availableCount: 2 },
    }),
  },
}));

vi.mock("@/lib/admin/saleroom-hub-page-data", () => ({
  buildSaleroomHubViewData: vi.fn().mockResolvedValue({
    rows: [],
    summaries: [],
    initialSessions: {},
    scheduledOnlyRows: [],
  }),
}));

describe("loadSaleroomHubPage", () => {
  it("returns summary and hub view on success", async () => {
    const { loadSaleroomHubPage } = await import("./load-saleroom-hub-page");
    const model = await loadSaleroomHubPage();
    expect(model.loadError).toBeNull();
    expect(model.summary.availableCount).toBe(2);
    expect(model.hubView?.summaries).toEqual([]);
  });

  it("captures load errors without throwing", async () => {
    const { saleroomHubController } = await import("@/lib/admin/saleroom-hub-controller");
    vi.mocked(saleroomHubController.fetch).mockRejectedValueOnce(new Error("network"));
    const { loadSaleroomHubPage } = await import("./load-saleroom-hub-page");
    const model = await loadSaleroomHubPage();
    expect(model.loadError).toBe("network");
    expect(model.hubView).toBeNull();
  });
});
