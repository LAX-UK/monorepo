import { describe, expect, it } from "vitest";
import { DEAL_VIEWS, dealIsInView, dealViewCounts, dealViewCriteria } from "./views.js";

describe("deal views", () => {
  it("offers every view once, active first", () => {
    expect(DEAL_VIEWS[0]).toBe("active");
    expect(new Set(DEAL_VIEWS).size).toBe(DEAL_VIEWS.length);
  });

  it("keeps settled and cancelled deals out of the working views", () => {
    for (const view of ["active", "needs_me", "waiting_on_checks", "payment_due"] as const) {
      expect(dealIsInView(view, { stage: "settled", ownerUserId: "u1" }, "u1")).toBe(false);
      expect(dealIsInView(view, { stage: "cancelled", ownerUserId: "u1" }, "u1")).toBe(false);
    }
  });

  it("puts an agreed deal under waiting on checks and an invoiced one under payment due", () => {
    expect(dealIsInView("waiting_on_checks", { stage: "agreed", ownerUserId: null }, "u")).toBe(
      true,
    );
    expect(dealIsInView("waiting_on_checks", { stage: "cleared", ownerUserId: null }, "u")).toBe(
      false,
    );
    expect(dealIsInView("payment_due", { stage: "invoiced", ownerUserId: null }, "u")).toBe(true);
  });

  it("shows needs me only to the owner", () => {
    const deal = { stage: "offer", ownerUserId: "owner" } as const;
    expect(dealIsInView("needs_me", deal, "owner")).toBe(true);
    expect(dealIsInView("needs_me", deal, "someone-else")).toBe(false);
  });

  it("counts each view from the counts per stage", () => {
    const counts = dealViewCounts([
      { stage: "offer", total: 3, ownedByViewer: 1 },
      { stage: "agreed", total: 2, ownedByViewer: 2 },
      { stage: "invoiced", total: 1, ownedByViewer: 0 },
      { stage: "settled", total: 4, ownedByViewer: 4 },
      { stage: "cancelled", total: 5, ownedByViewer: 0 },
    ]);
    expect(counts).toEqual({
      active: 6,
      needs_me: 3,
      waiting_on_checks: 2,
      payment_due: 1,
      settled: 4,
      cancelled: 5,
      all: 15,
    });
  });

  it("shows the longest wait first in working views and the latest first in archives", () => {
    expect(dealViewCriteria("active").order).toBe("oldest_first");
    expect(dealViewCriteria("settled").order).toBe("newest_first");
    expect(dealViewCriteria("all").stages).toBeNull();
  });
});
