import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminPaymentsListPage } from "./load-payments-list-page";

const { fetchPayments, fetchManual, getNavCounts, getUsers, getSessionUser } = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
  fetchManual: vi.fn(),
  getNavCounts: vi.fn(),
  getUsers: vi.fn(),
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/admin/admin-list-controllers", () => ({
  paymentStatusesForChip: ["all", "captured"],
  paymentsListController: {
    parseQuery: (sp: Record<string, string | undefined>) => ({
      q: sp.q,
      status: sp.status,
      offset: Number(sp.offset ?? 0),
      limit: Number(sp.limit ?? 50),
    }),
    fetch: fetchPayments,
  },
}));

vi.mock("@/lib/admin/manual-review-list-controller", () => ({
  manualReviewListController: {
    parseQuery: (sp: Record<string, string | undefined>) => ({
      manualReview: sp.manualReview === "1",
      reasonFilter: sp.manualReviewReason ?? "",
    }),
    fetch: fetchManual,
  },
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

const paymentRow = {
  id: "pay_1",
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  buyerId: "user_1",
  buyerLabel: null,
  sellerId: "seller_1",
  amount: "4140.00",
  amountDisplay: { primary: "£4,140.00" },
  platformFee: "414.00",
  status: "captured" as const,
  fulfilmentStatus: null,
  xeroInvoiceNumber: null,
  xeroOnlineInvoiceUrl: null,
  xeroSyncStatus: null,
  xeroLastError: null,
  createdAt: "2026-10-20T10:00:00.000Z",
};

describe("loadAdminPaymentsListPage", () => {
  beforeEach(() => {
    fetchPayments.mockReset();
    fetchManual.mockReset();
    getNavCounts.mockResolvedValue({ manualReviewCount: 3, disputesOpen: 1 });
    getUsers.mockResolvedValue([{ id: "user_1", name: "Ada Lovelace", email: null }]);
    getSessionUser.mockResolvedValue(null);
  });

  it("replaces a failed load with a plain message and no pagination", async () => {
    fetchPayments.mockRejectedValue(new Error("Failed to load payments: 500"));

    const result = await loadAdminPaymentsListPage({ limit: "50", offset: "0" });

    expect(result.mode).toBe("payments");
    if (result.mode !== "payments") return;
    expect(result.loadError).toBe(
      "We could not reach the payments service. Try again in a moment.",
    );
    expect(result.rows).toEqual([]);
    expect(result.pagination).toBeNull();
  });

  it("shapes rows for the staff list, with buyer names, money and the range summary", async () => {
    fetchPayments.mockResolvedValue({
      rows: [paymentRow],
      total: 51,
      paymentsSummary: { totalVolume: 4140, captured: 4140, pending: 0, refunded: 0 },
    });

    const result = await loadAdminPaymentsListPage({ q: "golden", period: "30" });

    if (result.mode !== "payments") throw new Error("expected payments");
    expect(result.rows[0]).toMatchObject({
      buyer: "Ada Lovelace",
      amount: "£4,140.00",
      amountPence: 414_000,
      canRefund: true,
      canCapture: false,
    });
    expect(result.attentionCounts).toEqual({ manualReviewCount: 3, disputesOpen: 1 });
    expect(result.pagination).toEqual({
      summary: "1–1 of 51 payments",
      prevHref: null,
      nextHref: "/admin/payments?q=golden&offset=50",
    });
  });

  it("loads manual review independently from the payment list", async () => {
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
