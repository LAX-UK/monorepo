import { describe, expect, it } from "vitest";
import {
  activePaymentsView,
  formatPaymentAmount,
  paymentPanelHref,
  paymentsAttention,
  paymentsFilterChips,
  paymentsListHref,
  paymentsMetrics,
  paymentsMetricsPeriod,
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

  it("gives every total its daily trend and change, and links captured and refunded", () => {
    const trend = (dailyPence: number[], priorPence: number) => ({
      dailyPence,
      currentPence: dailyPence.reduce((a, b) => a + b, 0),
      priorPence,
    });
    const summary = {
      totalVolume: 900,
      pending: 50,
      captured: 800,
      refunded: 50,
      trends: {
        periodDays: 30,
        volume: trend([0, 5000, 7000], 15000),
        captured: trend([0, 4000, 6000], 5000),
        refunded: trend([0, 1000, 0], 500),
        awaiting: trend([0, 0, 1000], 1000),
      },
    };
    const metrics = paymentsMetrics(summary, { q: "harbour" });
    const byId = Object.fromEntries(metrics.map((metric) => [metric.id, metric]));
    expect(byId.volume?.trend).toEqual([0, 5000, 7000]);
    expect(byId.volume?.comparison).toEqual({
      text: "20%",
      direction: "down",
      tone: "negative",
      basis: "vs previous 30 days",
    });
    expect(byId.captured?.comparison).toMatchObject({ direction: "up", tone: "positive" });
    // More refunded is bad news.
    expect(byId.refunded?.comparison).toMatchObject({ direction: "up", tone: "negative" });
    expect(byId.awaiting?.comparison).toMatchObject({ direction: "flat", tone: "neutral" });
    expect(byId.awaiting?.trendLabel).toBe(
      "Still awaiting capture, by the day each payment was created, last 30 days",
    );
    expect(byId.awaiting).toMatchObject({ tone: "attention" });
    expect(byId.awaiting?.href).toBeUndefined();
    expect(byId.captured?.href).toBe("/admin/payments?q=harbour&status=captured");
    expect(byId.refunded?.href).toBe("/admin/payments?q=harbour&status=refunded");
    expect(paymentsMetricsPeriod(summary, true)).toBe(
      "Payments matching this view and filters · daily trends over the last 30 days",
    );
    expect(paymentsMetricsPeriod({ ...summary, trends: undefined }, false)).toBe("All payments");
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

  it("links a payment's panel in the list URL and closes it by dropping the param", () => {
    expect(paymentPanelHref({ q: "golden", offset: "50" }, "pay-1")).toBe(
      "/admin/payments?q=golden&offset=50&payment=pay-1",
    );
    expect(paymentPanelHref({ q: "golden", payment: "pay-1" }, null)).toBe(
      "/admin/payments?q=golden",
    );
  });

  it("closes an open panel when the filters change", () => {
    expect(paymentsListHref({ payment: "pay-1" }, { status: "captured" })).toBe(
      "/admin/payments?status=captured",
    );
  });
});
