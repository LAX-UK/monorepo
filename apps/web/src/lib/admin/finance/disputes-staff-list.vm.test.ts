import type { DisputeDeskCaseSummary } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  activeDisputesView,
  disputeAllocationPresentation,
  disputeDeadlinePresentation,
  disputeReasonLabel,
  disputeStatusPresentation,
  disputeTitle,
  disputesFilterChips,
  disputesListHref,
  disputesRangeSummary,
  disputesViews,
  toDisputesStaffRows,
} from "./disputes-staff-list.vm";

const now = new Date("2026-11-01T12:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000).toISOString();

const summary = (patch: Partial<DisputeDeskCaseSummary> = {}): DisputeDeskCaseSummary => ({
  id: "case-1",
  stripeDisputeId: "dp_1",
  status: "needs_response",
  allocationState: "allocated",
  awaitingAllocation: false,
  amountPence: 480_000,
  currency: "gbp",
  reason: "product_unacceptable",
  dueBy: inDays(2),
  evidenceSubmitted: false,
  openedAt: "2026-10-30T09:14:00.000Z",
  closedAt: null,
  invoiceCount: 1,
  lotTitle: "Downs after rain",
  buyerId: "u1",
  buyerLabel: "Tom Ashworth",
  sellerNames: ["Northbank Gallery"],
  ...patch,
});

describe("disputeTitle", () => {
  it("names the lot of a single invoice", () => {
    expect(disputeTitle({ invoiceCount: 1, lotTitle: "Downs after rain" })).toBe(
      "Downs after rain",
    );
  });
  it("counts the lots on a shared payment", () => {
    expect(disputeTitle({ invoiceCount: 3, lotTitle: null })).toBe("3 lots on one payment");
  });
  it("says when nothing matched", () => {
    expect(disputeTitle({ invoiceCount: 0, lotTitle: null })).toBe("No matching payment");
  });
});

describe("disputeAllocationPresentation", () => {
  it("flags a shared charge that needs allocating", () => {
    expect(
      disputeAllocationPresentation({
        awaitingAllocation: true,
        allocationState: "needs_allocation",
        invoiceCount: 3,
      }),
    ).toEqual({ label: "Needs allocation", tone: "warning" });
  });
  it("flags a charge no payment matched", () => {
    expect(
      disputeAllocationPresentation({
        awaitingAllocation: true,
        allocationState: "needs_allocation",
        invoiceCount: 0,
      }),
    ).toEqual({ label: "No payment found", tone: "danger" });
  });
  it("shows an allocated case and one that never needed it", () => {
    expect(
      disputeAllocationPresentation({
        awaitingAllocation: false,
        allocationState: "allocated",
        invoiceCount: 1,
      }).label,
    ).toBe("Allocated");
    expect(
      disputeAllocationPresentation({
        awaitingAllocation: false,
        allocationState: "needs_allocation",
        invoiceCount: 2,
      }).label,
    ).toBe("Not needed");
  });
});

describe("disputeDeadlinePresentation", () => {
  it("is a danger badge with the days left when it is close", () => {
    expect(disputeDeadlinePresentation(summary({ dueBy: inDays(2) }), now)).toEqual({
      label: "2 days left",
      tone: "danger",
    });
  });
  it("is a warning badge within a week", () => {
    expect(disputeDeadlinePresentation(summary({ dueBy: inDays(5) }), now)).toEqual({
      label: "5 days left",
      tone: "warning",
    });
  });
  it("is plain text for a date further away", () => {
    expect(disputeDeadlinePresentation(summary({ dueBy: "2026-11-12T23:59:00Z" }), now)).toEqual({
      label: "Respond by 12 Nov",
      tone: null,
    });
  });
  it("says when it has passed", () => {
    expect(disputeDeadlinePresentation(summary({ dueBy: inDays(-2) }), now)).toMatchObject({
      label: "Overdue since 30 Oct",
      tone: "danger",
    });
  });
  it("says when evidence is in, and shows nothing for a closed case", () => {
    expect(disputeDeadlinePresentation(summary({ evidenceSubmitted: true }), now)?.label).toBe(
      "Evidence submitted",
    );
    expect(disputeDeadlinePresentation(summary({ status: "won" }), now)).toBeNull();
  });
});

describe("statuses and reasons", () => {
  it("presents Stripe's statuses on the kit's tones", () => {
    expect(disputeStatusPresentation("needs_response")).toEqual({
      label: "Needs response",
      tone: "warning",
    });
    expect(disputeStatusPresentation("lost").tone).toBe("danger");
    expect(disputeStatusPresentation("won").tone).toBe("success");
  });
  it("humanises a status it does not know", () => {
    expect(disputeStatusPresentation("brand_new_status")).toEqual({
      label: "Brand new status",
      tone: "neutral",
    });
  });
  it("labels reasons, with a fallback", () => {
    expect(disputeReasonLabel("duplicate")).toBe("Duplicate charge");
    expect(disputeReasonLabel(null)).toBe("Reason not given");
    expect(disputeReasonLabel("some_new_reason")).toBe("Some new reason");
  });
});

describe("toDisputesStaffRows", () => {
  it("builds the row the list shows", () => {
    const [row] = toDisputesStaffRows([summary()], now);
    expect(row).toMatchObject({
      id: "case-1",
      title: "Downs after rain",
      kind: "single",
      reason: "Product unacceptable",
      amount: "£4,800.00",
      buyer: "Tom Ashworth",
    });
    expect(row?.status.label).toBe("Needs response");
  });
  it("marks shared and unmatched cases", () => {
    const rows = toDisputesStaffRows(
      [summary({ invoiceCount: 3 }), summary({ invoiceCount: 0, buyerId: null })],
      now,
    );
    expect(rows.map((r) => r.kind)).toEqual(["shared", "unmatched"]);
    expect(rows[1]?.buyer).toBeNull();
  });
});

describe("views and links", () => {
  const counts = { needs_allocation: 2, open: 4, under_review: 1, closed: 9, all: 14 };

  it("lands on open cases unless the URL says otherwise", () => {
    expect(activeDisputesView({})).toBe("open");
    expect(activeDisputesView({ view: "closed" })).toBe("closed");
    expect(activeDisputesView({ view: "nonsense" })).toBe("open");
  });

  it("counts only the queues that are work waiting", () => {
    const views = disputesViews({}, counts);
    expect(views.map((v) => [v.id, v.count])).toEqual([
      ["needs_allocation", 2],
      ["open", 4],
      ["under_review", undefined],
      ["closed", undefined],
      ["all", undefined],
    ]);
  });

  it("leaves the default view's link clean and keeps other state", () => {
    const views = disputesViews({ q: "Hartley" }, counts);
    expect(views.find((v) => v.id === "open")?.href).toBe("/admin/disputes?q=Hartley");
    expect(views.find((v) => v.id === "closed")?.href).toBe(
      "/admin/disputes?q=Hartley&view=closed",
    );
  });

  it("restarts paging when the view or filters change", () => {
    expect(disputesListHref({ offset: "50", view: "open" }, { reason: "fraudulent" })).toBe(
      "/admin/disputes?view=open&reason=fraudulent",
    );
  });

  it("describes the reason filter as a removable chip", () => {
    expect(disputesFilterChips({ reason: "fraudulent", view: "closed" })).toEqual([
      {
        id: "reason",
        label: "Reason: Fraudulent",
        clearHref: "/admin/disputes?view=closed",
      },
    ]);
    expect(disputesFilterChips({})).toEqual([]);
  });

  it("summarises the range", () => {
    expect(disputesRangeSummary(0, 4, 4)).toBe("1–4 of 4 disputes");
    expect(disputesRangeSummary(50, 1, 51)).toBe("51–51 of 51 disputes");
    expect(disputesRangeSummary(0, 1, 1)).toBe("1–1 of 1 dispute");
  });
});
