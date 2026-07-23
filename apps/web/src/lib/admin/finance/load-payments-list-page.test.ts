import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminPaymentsListPage } from "./load-payments-list-page";

const { fetchPayments, fetchManual, getTrend, getNavCounts, getUsers, getSessionUser } = vi.hoisted(
  () => ({
    fetchPayments: vi.fn(),
    fetchManual: vi.fn(),
    getTrend: vi.fn(),
    getNavCounts: vi.fn(),
    getUsers: vi.fn(),
    getSessionUser: vi.fn(),
  }),
);

vi.mock("@/lib/admin/admin-list-controllers", () => ({
  paymentStatusesForChip: ["all", "captured"],
  paymentsListController: {
    parseQuery: (sp: Record<string, string | undefined>) => ({
      q: sp.q,
      status: sp.status,
      offset: Number(sp.offset ?? 0),
      limit: Number(sp.limit ?? 25),
    }),
    fetch: fetchPayments,
  },
}));

vi.mock("@/lib/admin/manual-review-list-controller", () => ({
  manualReviewListController: {
    parseQuery: (sp: Record<string, string | undefined>) => ({
      manualReview: sp.manualReview === "1",
      reasonFilter: sp.manualReviewReason,
    }),
    fetch: fetchManual,
  },
}));

vi.mock("@/lib/data/http/admin-kpi-trends.server", () => ({
  getAdminPaymentsKpiTrend: getTrend,
}));
vi.mock("@/lib/data/http/admin-nav-counts.server", () => ({
  getAdminNavCounts: getNavCounts,
}));
vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminUsersByIds: getUsers,
}));
vi.mock("@/lib/data/http/session.server", () => ({
  getServerSessionUser: getSessionUser,
}));

describe("loadAdminPaymentsListPage", () => {
  beforeEach(() => {
    fetchPayments.mockReset();
    fetchManual.mockReset();
    getTrend.mockResolvedValue({ currentTotal: 1, priorTotal: 1, dailyCounts: [1] });
    getNavCounts.mockResolvedValue({});
    getUsers.mockResolvedValue([]);
    getSessionUser.mockResolvedValue(null);
  });

  it("contains payment list failures in a composition-ready result", async () => {
    fetchPayments.mockRejectedValue(new Error("Payments unavailable"));

    const result = await loadAdminPaymentsListPage({ limit: "25", offset: "0" });

    expect(result.mode).toBe("payments");
    if (result.mode !== "payments") return;
    expect(result.loadError).toBe("Payments unavailable");
    expect(result.rows).toEqual([]);
    expect(result.pagination).toBeNull();
  });

  it("loads manual review independently from the payment board", async () => {
    fetchManual.mockResolvedValue({
      rows: [],
      allRows: [],
      summary: { total: 0, financeHolds: 0, complianceHolds: 0, amlHolds: 0, sofHolds: 0 },
    });

    const result = await loadAdminPaymentsListPage({ manualReview: "1" });

    expect(result.mode).toBe("manual-review");
    expect(fetchPayments).not.toHaveBeenCalled();
  });
});
