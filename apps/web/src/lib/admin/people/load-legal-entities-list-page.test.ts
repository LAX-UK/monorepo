import { describe, expect, it, vi } from "vitest";
import { loadAdminLegalEntitiesListPage } from "./load-legal-entities-list-page";

const { getPage, loadDetail } = vi.hoisted(() => ({
  getPage: vi.fn(),
  loadDetail: vi.fn(),
}));

vi.mock("@/lib/data/http/admin-legal-entities.reader", () => ({
  getAdminLegalEntitiesPage: getPage,
}));

vi.mock("@/lib/admin/load-admin-legal-entity-detail", () => ({
  loadAdminLegalEntityDetail: loadDetail,
}));

describe("loadAdminLegalEntitiesListPage", () => {
  it("returns authoritative summary and preview detail when entity param is set", async () => {
    getPage.mockResolvedValue({
      rows: [{ id: "le-1", displayName: "Gallery" }],
      total: 40,
      offset: 0,
      limit: 25,
      summary: {
        total: 40,
        byStatus: {
          lead: 0,
          docs_requested: 0,
          docs_received: 0,
          under_review: 1,
          connect_pending: 0,
          approved: 39,
          restricted: 0,
          rejected: 0,
          archived: 0,
        },
        stripeDueCount: 3,
        byKind: { individual: 5, organisation: 35 },
      },
      hasNextPage: true,
    });
    loadDetail.mockResolvedValue({ entity: { id: "le-99", displayName: "Off page" } });

    const result = await loadAdminLegalEntitiesListPage({ entity: "le-99", stripe: "1" });

    expect(result.loadError).toBeNull();
    expect(result.summary.stripeDueCount).toBe(3);
    expect(result.preview?.entity.id).toBe("le-99");
    expect(result.model.hasFilters).toBe(true);
    expect(loadDetail).toHaveBeenCalledWith("le-99");
  });

  it("contains list failures and preserves the page model", async () => {
    getPage.mockRejectedValue(new Error("Legal entities unavailable"));

    const result = await loadAdminLegalEntitiesListPage({ q: "gallery" });

    expect(result.loadError).toBe("Legal entities unavailable");
    expect(result.rows).toEqual([]);
    expect(result.summary.total).toBe(0);
    expect(result.preview).toBeNull();
    expect(result.model.hasFilters).toBe(true);
  });
});
