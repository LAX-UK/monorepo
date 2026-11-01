import { describe, expect, it } from "vitest";
import { disputeBelongsToView, disputeDeadline, disputeStatusView } from "./dispute-case-view.js";

const now = new Date("2026-11-01T12:00:00Z");
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000);

describe("disputeStatusView", () => {
  it.each([
    ["needs_response", "open"],
    ["warning_needs_response", "open"],
    ["under_review", "under_review"],
    ["warning_under_review", "under_review"],
    ["won", "closed"],
    ["lost", "closed"],
    ["warning_closed", "closed"],
    ["prevented", "closed"],
  ])("puts %s in %s", (status, view) => {
    expect(disputeStatusView(status)).toBe(view);
  });

  it("treats a status it does not know as work waiting", () => {
    expect(disputeStatusView("something_new")).toBe("open");
  });
});

describe("disputeBelongsToView", () => {
  it("holds a case waiting for allocation in its own queue as well as its status view", () => {
    const facts = { status: "needs_response", allocationState: "needs_allocation" as const };
    expect(disputeBelongsToView("needs_allocation", facts)).toBe(true);
    expect(disputeBelongsToView("open", facts)).toBe(true);
    expect(disputeBelongsToView("closed", facts)).toBe(false);
  });

  it("drops a won case out of the allocation queue", () => {
    const facts = { status: "won", allocationState: "needs_allocation" as const };
    expect(disputeBelongsToView("needs_allocation", facts)).toBe(false);
    expect(disputeBelongsToView("closed", facts)).toBe(true);
  });
});

describe("disputeDeadline", () => {
  const open = { status: "needs_response", evidenceSubmitted: false };

  it("has no deadline once the case is closed or Stripe sent none", () => {
    expect(disputeDeadline({ ...open, status: "lost", dueBy: inDays(2) }, now).state).toBe("none");
    expect(disputeDeadline({ ...open, dueBy: null }, now).state).toBe("none");
  });

  it("reports evidence already submitted instead of a countdown", () => {
    expect(disputeDeadline({ ...open, evidenceSubmitted: true, dueBy: inDays(2) }, now)).toEqual({
      state: "submitted",
      daysLeft: null,
    });
  });

  it("is overdue at and after the respond-by time", () => {
    expect(disputeDeadline({ ...open, dueBy: now }, now).state).toBe("overdue");
    expect(disputeDeadline({ ...open, dueBy: inDays(-1) }, now).state).toBe("overdue");
  });

  it.each([
    [0.4, "urgent", 1],
    [3, "urgent", 3],
    [3.2, "soon", 4],
    [7, "soon", 7],
    [8, "ok", 8],
  ])("%s days out is %s with %s days left", (days, state, daysLeft) => {
    expect(disputeDeadline({ ...open, dueBy: inDays(days) }, now)).toEqual({ state, daysLeft });
  });
});
