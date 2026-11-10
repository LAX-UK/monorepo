import { describe, expect, it } from "vitest";
import { planPaymentClearedBackfill } from "./backfill-payment-cleared-at.plan.js";

const at = (iso: string) => new Date(iso);

describe("backfilling when payment cleared", () => {
  it("takes the time from the payment's capture event", () => {
    const plan = planPaymentClearedBackfill(
      [{ lotId: "l-1", status: "released", paymentClearedAt: null }],
      [{ lotId: "l-1", capturedAt: at("2026-10-20T10:15:00Z") }],
    );
    expect(plan.dates).toEqual([{ lotId: "l-1", clearedAt: at("2026-10-20T10:15:00Z") }]);
  });

  it("uses the earliest capture when a lot has more than one", () => {
    const plan = planPaymentClearedBackfill(
      [{ lotId: "l-1", status: "released", paymentClearedAt: null }],
      [
        { lotId: "l-1", capturedAt: at("2026-10-25T10:00:00Z") },
        { lotId: "l-1", capturedAt: at("2026-10-20T10:00:00Z") },
      ],
    );
    expect(plan.dates[0]?.clearedAt).toEqual(at("2026-10-20T10:00:00Z"));
  });

  it("reports a paid lot with no capture event instead of guessing", () => {
    const plan = planPaymentClearedBackfill(
      [{ lotId: "l-1", status: "ready_for_collection", paymentClearedAt: null }],
      [],
    );
    expect(plan).toEqual({ dates: [], withoutEvent: ["l-1"], alreadyDated: 0 });
  });

  it("leaves alone a lot not paid yet and a lot that already has a date", () => {
    const plan = planPaymentClearedBackfill(
      [
        { lotId: "l-1", status: "awaiting_payment", paymentClearedAt: null },
        { lotId: "l-2", status: "released", paymentClearedAt: at("2026-10-01T09:00:00Z") },
      ],
      [
        { lotId: "l-1", capturedAt: at("2026-10-20T10:00:00Z") },
        { lotId: "l-2", capturedAt: at("2026-10-20T10:00:00Z") },
      ],
    );
    expect(plan).toEqual({ dates: [], withoutEvent: [], alreadyDated: 1 });
  });
});
