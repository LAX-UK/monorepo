import { describe, expect, it } from "vitest";
import { carrierTrackingUrl, fulfilmentStageColumn, orderProblemWindow } from "./order-progress.js";

describe("fulfilmentStageColumn", () => {
  it("dates production, dispatch, collection readiness and cancellation", () => {
    expect(fulfilmentStageColumn("in_production")).toBe("productionStartedAt");
    expect(fulfilmentStageColumn("in_transit")).toBe("dispatchedAt");
    expect(fulfilmentStageColumn("ready_for_collection")).toBe("readyForCollectionAt");
    expect(fulfilmentStageColumn("cancelled")).toBe("cancelledAt");
    expect(fulfilmentStageColumn("delivered")).toBeNull();
    expect(fulfilmentStageColumn("awaiting_dispatch")).toBeNull();
  });
});

describe("carrierTrackingUrl", () => {
  it("links Royal Mail numbers to its tracking page", () => {
    expect(carrierTrackingUrl("Royal Mail Special Delivery", " AB123456789GB ")).toBe(
      "https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB",
    );
  });

  it("gives no link for other carriers or a missing number", () => {
    expect(carrierTrackingUrl("Art courier", "X1")).toBeNull();
    expect(carrierTrackingUrl("Royal Mail", "  ")).toBeNull();
  });
});

describe("orderProblemWindow", () => {
  const paidAt = new Date("2026-10-01T10:00:00Z");
  const now = new Date("2026-10-20T10:00:00Z");

  it("is open from payment while nothing has been delivered", () => {
    expect(
      orderProblemWindow({
        status: "paid",
        paidAt,
        refundPeriodEndsAt: null,
        possessionAt: null,
        now,
      }),
    ).toEqual({ open: true, endsAt: null });
  });

  it("closes when the recorded cancellation period ends", () => {
    const endsAt = new Date("2026-10-19T10:00:00Z");
    expect(
      orderProblemWindow({
        status: "paid",
        paidAt,
        refundPeriodEndsAt: endsAt,
        possessionAt: null,
        now,
      }),
    ).toEqual({ open: false, reason: "closed", endsAt });
  });

  it("falls back to 14 days after delivery when no period was recorded", () => {
    const window = orderProblemWindow({
      status: "partially_refunded",
      paidAt,
      refundPeriodEndsAt: null,
      possessionAt: new Date("2026-10-10T10:00:00Z"),
      now,
    });
    expect(window).toEqual({ open: true, endsAt: new Date("2026-10-24T10:00:00Z") });
  });

  it("stays shut for unpaid and wholly refunded orders", () => {
    const base = { paidAt: null, refundPeriodEndsAt: null, possessionAt: null, now };
    expect(orderProblemWindow({ ...base, status: "pending_payment" })).toMatchObject({
      open: false,
      reason: "not_paid",
    });
    expect(orderProblemWindow({ ...base, paidAt, status: "refunded" })).toMatchObject({
      open: false,
      reason: "refunded",
    });
  });
});
