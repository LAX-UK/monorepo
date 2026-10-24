import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminPayoutsListPage } from "./load-payouts-list-page";

const { getPage, getEntity, getSession, getNavCounts } = vi.hoisted(() => ({
  getPage: vi.fn(),
  getEntity: vi.fn(),
  getSession: vi.fn(),
  getNavCounts: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin-payouts.reader", () => ({ getAdminPayoutsPage: getPage }));
vi.mock("@/lib/data/http/admin-legal-entities.reader", () => ({
  getAdminLegalEntityById: getEntity,
}));
vi.mock("@/lib/data/http/admin-nav-counts.server", () => ({ getAdminNavCounts: getNavCounts }));
vi.mock("@/lib/data/http/session.server", () => ({ getServerSessionUser: getSession }));

const summary = {
  total: 40,
  scheduled: 10,
  inTransit: 5,
  paid: 20,
  failed: 3,
  reversed: 1,
  clawbackPending: 1,
  totalNet: "1000.00",
  readiness: {
    inFlightCount: 15,
    missingTransferRefCount: 2,
    withFailureReasonCount: 1,
    withStatementErrorCount: 0,
    clawbackCount: 1,
    failedCount: 3,
    reversedCount: 1,
    blockerPayoutCount: 4,
  },
};

const payout = {
  id: "payout_1",
  legalEntityId: "entity_1",
  periodStart: "2026-10-01T00:00:00.000Z",
  periodEnd: "2026-10-31T00:00:00.000Z",
  grossAmount: "1000",
  platformFee: "100",
  stripeFee: "0",
  netAmount: "900",
  currency: "GBP",
  status: "scheduled" as const,
  stripeTransferId: null,
  xeroBillId: null,
  failureReason: null,
  processedAt: null,
  statementUrl: null,
  statementGenerationError: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  legalEntityName: "Gallery One",
};

describe("loadAdminPayoutsListPage", () => {
  beforeEach(() => {
    for (const fn of [getPage, getEntity, getSession, getNavCounts]) fn.mockReset();
    getSession.mockResolvedValue({ role: "staff", staffRole: "finance_ops" });
    getNavCounts.mockResolvedValue({ disputesOpen: 2 });
    getEntity.mockResolvedValue({ displayName: "Gallery One" });
  });

  it("returns rows with seller names from the list read, the filtered summary and paging", async () => {
    getPage.mockResolvedValue({
      rows: [payout],
      total: 120,
      offset: 50,
      limit: 50,
      summary,
      hasNextPage: true,
    });

    const result = await loadAdminPayoutsListPage({ offset: "50", status: "scheduled" });

    expect(getPage).toHaveBeenCalledWith({ limit: 50, offset: 50, status: "scheduled" });
    expect(result.loadError).toBeNull();
    expect(result.rows[0]).toMatchObject({ seller: "Gallery One", net: "£900.00" });
    // The names come with the rows: no lookup per seller.
    expect(getEntity).not.toHaveBeenCalled();
    expect(result.summary.readiness.inFlightCount).toBe(15);
    expect(result.capabilities.canProcess).toBe(true);
    expect(result.disputesOpen).toBe(2);
    expect(result.pageSize).toBe(50);
    expect(result.exportFilters).toEqual({ status: "scheduled" });
    expect(result.pagination).toEqual({
      summary: "51–51 of 120 payouts",
      prevHref: "/admin/payouts?offset=0&status=scheduled",
      nextHref: "/admin/payouts?offset=100&status=scheduled",
    });
  });

  it("reads the page size from the URL and keeps the export to the same filters", async () => {
    getPage.mockResolvedValue({
      rows: [],
      total: 0,
      offset: 0,
      limit: 25,
      summary,
      hasNextPage: false,
    });

    const result = await loadAdminPayoutsListPage({ limit: "25", legalEntityId: "entity_1" });

    expect(getPage).toHaveBeenCalledWith({ limit: 25, offset: 0, legalEntityId: "entity_1" });
    expect(result.pageSize).toBe(25);
    expect(result.exportFilters).toEqual({ legalEntityId: "entity_1" });
    expect(result.sellerFilterName).toBe("Gallery One");
  });

  it("keeps a short reference for a seller whose name the list does not carry", async () => {
    getPage.mockResolvedValue({
      rows: [{ ...payout, legalEntityName: null }],
      total: 1,
      offset: 0,
      limit: 50,
      summary,
      hasNextPage: false,
    });

    const result = await loadAdminPayoutsListPage({});

    expect(result.rows[0]?.seller).toBe("Seller entity_1");
    expect(getEntity).not.toHaveBeenCalled();
  });

  it("contains list failures in plain language, without the raw error", async () => {
    getSession.mockResolvedValue(null);
    getPage.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:443"));

    const result = await loadAdminPayoutsListPage({ status: "failed" });

    expect(result.loadError).toBe("We could not reach the payouts service. Try again in a moment.");
    expect(result.rows).toEqual([]);
    expect(result.capabilities.canProcess).toBe(false);
    expect(result.pagination).toBeNull();
  });
});
