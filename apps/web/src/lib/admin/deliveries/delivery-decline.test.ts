import { describe, expect, it } from "vitest";
import { BOOKED_UNPAID, DECLINED, deliveryFixture } from "./deliveries.fixture";
import {
  canDeclineDelivery,
  deliveryDeclineErrorMessage,
  isStaleDecline,
  validateDeclineReason,
} from "./delivery-decline";

describe("canDeclineDelivery", () => {
  const quoted = deliveryFixture({
    status: "quoted",
    quote: { ...BOOKED_UNPAID.quote, status: "quoted" },
  });

  it("offers Can't deliver in Waiting for a price and Quote sent, to write roles only (D5)", () => {
    expect(canDeclineDelivery(deliveryFixture(), true)).toBe(true);
    expect(canDeclineDelivery(quoted, true)).toBe(true);
    expect(canDeclineDelivery(deliveryFixture(), false)).toBe(false);
    expect(canDeclineDelivery(quoted, false)).toBe(false);
  });

  it("does not offer it once booked or closed, or with no delivery open", () => {
    expect(canDeclineDelivery(BOOKED_UNPAID, true)).toBe(false);
    expect(canDeclineDelivery(DECLINED, true)).toBe(false);
    expect(canDeclineDelivery(null, true)).toBe(false);
  });
});

describe("validateDeclineReason", () => {
  it("needs a reason of 1 to 500 characters once trimmed, as the API does", () => {
    expect(validateDeclineReason("   ")).toBe("Tell the buyer why you can't deliver");
    expect(validateDeclineReason("x".repeat(501))).toBe("Use 500 characters or fewer");
    expect(validateDeclineReason(`  ${"x".repeat(500)}  `)).toBeNull();
  });
});

describe("decline errors", () => {
  it("treats a quote that changed or moved on as stale (D6)", () => {
    expect(isStaleDecline("quote_changed")).toBe(true);
    expect(isStaleDecline("quote_step_not_allowed")).toBe(true);
    expect(isStaleDecline("purchase_not_found")).toBe(false);
    expect(isStaleDecline(undefined)).toBe(false);
  });

  it("says plainly what went wrong, and that nothing was sent when the API didn't answer", () => {
    expect(deliveryDeclineErrorMessage(undefined, 403)).toMatch(/permission/);
    expect(deliveryDeclineErrorMessage("purchase_not_found", 404)).toMatch(/no longer has a buyer/);
    expect(deliveryDeclineErrorMessage("idempotency_key_reuse", 422)).toBe(
      "Check the reason and try again.",
    );
    expect(deliveryDeclineErrorMessage(undefined, undefined)).toMatch(/Nothing was sent/);
  });
});
