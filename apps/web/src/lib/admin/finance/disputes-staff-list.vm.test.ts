import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import { describe, expect, it } from "vitest";
import {
  activeDisputesView,
  disputePanelHref,
  disputesAttention,
  disputesListHref,
  disputesMetrics,
  disputesRangeSummary,
  disputesViewTotal,
  disputesViews,
  toDisputesStaffRows,
} from "./disputes-staff-list.vm";

const summary = { open: 4, underReview: 2, won: 3, lost: 1, closed: 5 };

const row: AdminDisputeTableRow = {
  stripeDisputeId: "dp_1",
  paymentId: "pay_1",
  status: "warning_needs_response",
  amountDisplay: { primary: "£125.00" } as AdminDisputeTableRow["amountDisplay"],
  amountCents: 12_500,
  currency: "gbp",
  reason: "fraudulent",
  reasonLabel: "Fraudulent",
  sellerLegalEntityId: "11111111-2222-3333-4444-555555555555",
  sellerDisplayName: null,
  openedAt: new Date("2026-10-01T10:00:00.000Z"),
  closedAt: null,
  outcome: null,
  lotId: null,
  lotTitle: null,
  buyerId: null,
  buyerLabel: null,
  timelineEvents: [
    {
      id: "e1",
      eventType: "payment.dispute_opened",
      payload: {},
      occurredAt: "2026-10-01T10:00:00.000Z",
    },
    {
      id: "e2",
      eventType: "payment.dispute_closed",
      payload: {},
      occurredAt: "2026-10-05T10:00:00.000Z",
    },
  ],
};

describe("disputes staff list view model", () => {
  it("turns a case into plain data with readable fallbacks", () => {
    const [staff] = toDisputesStaffRows([row]);
    expect(staff).toMatchObject({
      id: "dp_1",
      title: "Dispute case",
      reason: "Fraudulent",
      amount: "£125.00",
      seller: "Seller 11111111",
      buyer: null,
      openedAt: "2026-10-01T10:00:00.000Z",
      closedAt: null,
      statusPresentation: { label: "Needs response" },
    });
    expect(staff?.timeline.map((event) => event.id)).toEqual(["e2", "e1"]);
    expect(staff?.timeline.every((event) => typeof event.title === "string")).toBe(true);
  });

  it("names the buyer, and a generic buyer when only the ID is known", () => {
    const [named, unnamed] = toDisputesStaffRows([
      { ...row, buyerId: "user_1", buyerLabel: "Ada Lovelace" },
      { ...row, buyerId: "user_2", buyerLabel: null },
    ]);
    expect(named?.buyer).toBe("Ada Lovelace");
    expect(unnamed?.buyer).toBe("Buyer");
  });

  it("builds list links that restart paging and a panel link that keeps the page", () => {
    const search = { status: "open", offset: "50", dispute: "dp_1" };
    expect(disputesListHref(search, { status: null })).toBe("/admin/disputes");
    expect(disputesListHref(search, { offset: 100 })).toBe(
      "/admin/disputes?status=open&offset=100",
    );
    expect(disputePanelHref(search, "dp_2")).toBe(
      "/admin/disputes?status=open&offset=50&dispute=dp_2",
    );
    expect(disputePanelHref(search, null)).toBe("/admin/disputes?status=open&offset=50");
  });

  it("offers the status lenses with a count only on the open cases", () => {
    const views = disputesViews({}, summary);
    expect(views.map((view) => view.label)).toEqual(["All", "Open", "Under review", "Closed"]);
    expect(views.filter((view) => view.count !== undefined)).toEqual([
      expect.objectContaining({ id: "open", count: 4 }),
    ]);
    expect(activeDisputesView({ status: "under_review" })).toBe("under_review");
    expect(activeDisputesView({ status: "nonsense" })).toBe("all");
  });

  it("counts the cases a view holds from the queue summary", () => {
    expect(disputesViewTotal("all", summary)).toBe(15);
    expect(disputesViewTotal("open", summary)).toBe(4);
    expect(disputesViewTotal("under_review", summary)).toBe(2);
    expect(disputesViewTotal("closed", summary)).toBe(9);
  });

  it("asks for a response unless the open cases are already on screen", () => {
    expect(disputesAttention({}, summary, "all").map((item) => [item.count, item.label])).toEqual([
      [4, "disputes need a response"],
    ]);
    expect(disputesAttention({}, { ...summary, open: 1 }, "all")[0]?.label).toBe(
      "dispute needs a response",
    );
    expect(disputesAttention({}, summary, "open")).toEqual([]);
  });

  it("summarises the whole queue in four numbers", () => {
    expect(disputesMetrics(summary).map((metric) => [metric.label, metric.value])).toEqual([
      ["Open", "4"],
      ["Under review", "2"],
      ["Won", "3"],
      ["Lost", "1"],
    ]);
  });

  it("states the range with the total", () => {
    expect(disputesRangeSummary(0, 50, 312)).toBe("1–50 of 312 disputes");
    expect(disputesRangeSummary(0, 1, 1)).toBe("1–1 of 1 dispute");
  });
});
