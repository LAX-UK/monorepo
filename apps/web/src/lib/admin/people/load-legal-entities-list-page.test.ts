import { describe, expect, it, vi } from "vitest";
import { loadAdminLegalEntitiesListPage } from "./load-legal-entities-list-page";

const { getPage, loadDetail } = vi.hoisted(() => ({
  getPage: vi.fn(),
  loadDetail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-legal-entities.reader", () => ({
  getAdminLegalEntitiesPage: getPage,
}));
vi.mock("@/lib/admin/load-admin-legal-entity-detail", () => ({
  loadAdminLegalEntityDetail: loadDetail,
}));

const summary = {
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
};

const listRow = {
  id: "le-1",
  displayName: "Gallery",
  status: "approved" as const,
  kind: "organisation" as const,
  subkind: "gallery" as const,
  updatedAt: "2026-10-20T10:00:00.000Z",
  stripeDueCount: 0,
};

describe("loadAdminLegalEntitiesListPage", () => {
  it("returns rows, the directory summary, paging and the open entity's details", async () => {
    getPage.mockResolvedValue({
      rows: [listRow],
      total: 40,
      offset: 25,
      limit: 25,
      summary,
      hasNextPage: true,
    });
    loadDetail.mockResolvedValue({
      entity: {
        id: "le-99",
        displayName: "Off page",
        status: "approved",
        kind: "individual",
        subkind: "artist",
        updatedAt: new Date("2026-10-21T10:00:00.000Z"),
        isLaxManaged: false,
        platformFeeBps: 250,
        stripeConnectAccountId: "acct_gallery",
        stripeConnectPayoutsEnabled: true,
        stripeConnectRequirementsCurrentlyDue: [],
        stripeConnectRequirementsErrors: [],
      },
      creator: null,
      documents: [{ reviewStatus: "pending" }, { reviewStatus: "approved" }],
      health: {
        stageLabel: "Ready",
        canPublish: true,
        canReceivePayouts: true,
        blockers: [],
        statusReason: null,
      },
      canViewOwner: true,
      canViewDocuments: true,
    });

    const result = await loadAdminLegalEntitiesListPage({
      entity: "le-99",
      stripe: "1",
      offset: "25",
      limit: "25",
    });

    expect(getPage).toHaveBeenCalledWith({ limit: 25, offset: 25, stripeDue: true });
    expect(loadDetail).toHaveBeenCalledWith("le-99");
    expect(result.loadError).toBeNull();
    expect(result.view).toBe("stripe");
    expect(result.summary.stripeDueCount).toBe(3);
    expect(result.rows[0]).toMatchObject({ name: "Gallery", kind: "Organisation · Gallery" });
    expect(result.preview).toMatchObject({
      platformFee: "2.50%",
      stripeConnect: "Payouts enabled",
      documents: { total: 2, pending: 1 },
    });
    expect(result.pagination).toEqual({
      summary: "26–26 of 40 legal entities",
      prevHref: "/admin/legal-entities?stripe=1&offset=0&limit=25",
      nextHref: "/admin/legal-entities?stripe=1&offset=50&limit=25",
    });
  });

  it("passes search, status and kind to the API", async () => {
    getPage.mockResolvedValue({
      rows: [],
      total: 0,
      offset: 0,
      limit: 50,
      summary,
      hasNextPage: false,
    });

    await loadAdminLegalEntitiesListPage({
      q: "gallery",
      status: "approved",
      kind: "organisation",
    });

    expect(getPage).toHaveBeenCalledWith({
      limit: 50,
      offset: 0,
      q: "gallery",
      status: "approved",
      kind: "organisation",
    });
  });

  it("contains list failures in plain language, without the raw error", async () => {
    getPage.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:443"));

    const result = await loadAdminLegalEntitiesListPage({ q: "gallery" });

    expect(result.loadError).toBe("We could not load legal entities. Try again in a moment.");
    expect(result.rows).toEqual([]);
    expect(result.summary.total).toBe(0);
    expect(result.preview).toBeNull();
  });

  it("says plainly when the viewer has no access", async () => {
    getPage.mockRejectedValue(new Error("forbidden"));
    const result = await loadAdminLegalEntitiesListPage({});
    expect(result.loadError).toBe("You do not have access to legal entities.");
  });
});
