import { describe, expect, it } from "vitest";
import {
  activePaymentsView,
  formatPaymentAmount,
  paymentsAttention,
  paymentsFilterChips,
  paymentsListHref,
  paymentsMetrics,
  paymentsRangeSummary,
  paymentsViews,
} from "./payments-staff-list.vm";

describe("payments staff list view model", () => {
  it("formats amounts in full, never abbreviated or cut", () => {
    expect(formatPaymentAmount("1600")).toBe("£1,600.00");
    expect(formatPaymentAmount("604.8")).toBe("£604.80");
    expect(formatPaymentAmount("not money")).toBe("not money");
  });

  it("builds list links that drop one-off params and restart paging", () => {
    const search = { q: "golden", offset: "50", success: "Done", period: "30" };
    expect(paymentsListHref(search, { status: "captured" })).toBe(
      "/admin/payments?q=golden&status=captured",
    );
    expect(paymentsListHref(search, { offset: 100 })).toBe("/admin/payments?q=golden&offset=100");
  });

  it("offers status views and the manual review queue, with a count only on the queue", () => {
    const views = paymentsViews({ q: "golden" }, 10);
    expect(views.map((view) => view.label)).toEqual([
      "All",
      "Pending",
      "Authorised",
      "Captured",
      "Refunded",
      "Manual review",
    ]);
    expect(views.filter((view) => view.count !== undefined)).toEqual([
      expect.objectContaining({ id: "manual-review", count: 10 }),
    ]);
    expect(views[0]?.href).toBe("/admin/payments");
    expect(activePaymentsView({ manualReview: "1" })).toBe("manual-review");
    expect(activePaymentsView({ status: "captured" })).toBe("captured");
    expect(activePaymentsView({ status: "nonsense" })).toBe("all");
  });

  it("lists the waiting work, leaving out the queue the page already shows", () => {
    const counts = { manualReviewCount: 10, disputesOpen: 1 };
    expect(paymentsAttention({}, counts, "all").map((item) => [item.count, item.label])).toEqual([
      [10, "payments need manual review"],
      [1, "dispute is open"],
    ]);
    expect(paymentsAttention({}, counts, "manual-review").map((item) => item.id)).toEqual([
      "disputes",
    ]);
  });

  it("summarises the matching payments in four full amounts", () => {
    const metrics = paymentsMetrics({ totalVolume: 1.6, pending: 0, captured: 604.8, refunded: 0 });
    expect(metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ["Volume", "£1.60"],
      ["Awaiting capture", "£0.00"],
      ["Captured", "£604.80"],
      ["Refunded", "£0.00"],
    ]);
  });

  it("shows filters beyond the status view as chips, never the status itself", () => {
    const chips = paymentsFilterChips({
      status: "captured",
      q: "golden",
      fulfilment: "in_transit,delivered",
      xero: "missing",
    });
    expect(chips.map((chip) => chip.label)).toEqual([
      "“golden”",
      "Fulfilment: In transit, Delivered",
      "Xero: No invoice yet",
    ]);
    expect(chips[1]?.clearHref).toBe("/admin/payments?status=captured&q=golden&xero=missing");
  });

  it("states the range shown", () => {
    expect(paymentsRangeSummary(50, 50, 1312)).toBe("51–100 of 1,312 payments");
  });
});
