import { describe, expect, it, vi } from "vitest";
import { loadAdminDisputesListPage } from "./load-disputes-list-page";

const { getPage } = vi.hoisted(() => ({ getPage: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/disputes.server", () => ({ getAdminDisputesPage: getPage }));

const row = {
  stripeDisputeId: "dp_1",
  paymentId: "pay_1",
  status: "open" as const,
  amountDisplay: { primary: "£125.00" },
  amountCents: 12_500,
  currency: "gbp",
  reason: "fraudulent",
  reasonLabel: "Fraudulent",
  sellerLegalEntityId: "entity_1",
  sellerDisplayName: "Gallery One",
  openedAt: new Date("2026-10-01T10:00:00.000Z"),
  closedAt: null,
  outcome: null,
  lotId: "lot_1",
  lotTitle: "Golden Hour",
  buyerId: "user_1",
  buyerLabel: "Ada Lovelace",
  timelineEvents: [],
};

const summary = { open: 60, underReview: 2, won: 3, lost: 1, closed: 0 };

describe("loadAdminDisputesListPage", () => {
  it("returns plain rows, the queue summary and paging for the view", async () => {
    getPage.mockResolvedValue({ rows: [row], hasNextPage: true, summary });

    const result = await loadAdminDisputesListPage({ status: "open", limit: "25" });

    expect(getPage).toHaveBeenCalledWith({ limit: 25, offset: 0, status: "open" });
    expect(result.loadError).toBeNull();
    expect(result.pageSize).toBe(25);
    expect(result.rows[0]).toMatchObject({
      id: "dp_1",
      title: "Golden Hour",
      amount: "£125.00",
      seller: "Gallery One",
      openedAt: "2026-10-01T10:00:00.000Z",
    });
    expect(result.pagination).toEqual({
      summary: "1–1 of 60 disputes",
      prevHref: null,
      nextHref: "/admin/disputes?status=open&limit=25&offset=25",
    });
  });

  it("contains list failures in plain language, without the raw error", async () => {
    getPage.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:443"));

    const result = await loadAdminDisputesListPage({ status: "open" });

    expect(result.loadError).toBe(
      "We could not reach the disputes service. Try again in a moment.",
    );
    expect(result.rows).toEqual([]);
    expect(result.view).toBe("open");
  });
});
