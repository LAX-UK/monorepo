import { describe, expect, it } from "vitest";
import {
  assertQuantityWithinSellable,
  computeMerchandiseSubtotal,
  computeOrderTotal,
} from "./basket-totals.js";
import { countSellableEditions, isEditionSellable } from "./edition-sellability.js";
import { fulfilmentSurchargePence, isOnlineCheckoutFulfilment } from "./fulfilment-options.js";
import { pence } from "./money.js";
import { assertOrderTransition, canTransitionOrder } from "./order-state.js";
import { computePayoutDueAt, computeRefundPeriodEndsAt } from "./payout-due.js";
import { reservedUntilFromCheckoutExpiry } from "./reservation-timing.js";

describe("edition sellability", () => {
  const now = new Date("2026-01-01T12:00:00Z");

  it("requires an owner and authorised listing status", () => {
    expect(
      isEditionSellable({
        ownerPartyId: "party-1",
        listingStatus: "authorised",
        custodyStatus: "unprinted",
        reservedUntil: null,
        reservedByPendingOrder: false,
        now,
      }),
    ).toBe(true);
    expect(
      isEditionSellable({
        ownerPartyId: null,
        listingStatus: "authorised",
        custodyStatus: "unprinted",
        reservedUntil: null,
        reservedByPendingOrder: false,
        now,
      }),
    ).toBe(false);
  });

  it("reclaims expired reservations", () => {
    expect(
      isEditionSellable({
        ownerPartyId: "party-1",
        listingStatus: "reserved",
        custodyStatus: "unprinted",
        reservedUntil: new Date("2026-01-01T11:00:00Z"),
        reservedByPendingOrder: false,
        now,
      }),
    ).toBe(true);
  });
});

describe("basket totals", () => {
  it("sums line totals and fulfilment surcharge", () => {
    const subtotal = computeMerchandiseSubtotal([{ unitPricePence: pence(1000), quantity: 2 }]);
    expect(subtotal).toBe(2000);
    expect(
      computeOrderTotal({
        merchandiseSubtotalPence: subtotal,
        fulfilment: "uk_insured_delivery",
      }),
    ).toBe(2000 + fulfilmentSurchargePence("uk_insured_delivery"));
  });

  it("caps quantity to sellable stock", () => {
    expect(() => assertQuantityWithinSellable(3, 2)).toThrow();
  });
});

describe("order state", () => {
  it("allows payment completion from pending", () => {
    expect(canTransitionOrder("pending_payment", "paid")).toBe(true);
    expect(() => assertOrderTransition("paid", "pending_payment")).toThrow();
  });
});

describe("payout timing", () => {
  it("sets refund period end 14 days after payment", () => {
    const paidAt = new Date("2026-01-01T00:00:00Z");
    const ends = computeRefundPeriodEndsAt(paidAt);
    expect(ends.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(computePayoutDueAt(ends)).toEqual(ends);
  });
});

describe("reservation timing", () => {
  it("extends reservation past checkout session expiry", () => {
    const expires = new Date("2026-01-01T12:30:00Z");
    expect(reservedUntilFromCheckoutExpiry(expires).getTime()).toBe(expires.getTime() + 60_000);
  });
});

describe("fulfilment", () => {
  it("blocks international from online checkout", () => {
    expect(isOnlineCheckoutFulfilment("international_quotation")).toBe(false);
  });
});

describe("countSellableEditions", () => {
  it("counts only owned available rows", () => {
    const now = new Date();
    expect(
      countSellableEditions(
        [
          {
            ownerPartyId: "a",
            listingStatus: "authorised",
            custodyStatus: "unprinted",
            reservedUntil: null,
            reservedByPendingOrder: false,
            now,
          },
          {
            ownerPartyId: null,
            listingStatus: "not_authorised",
            custodyStatus: "unprinted",
            reservedUntil: null,
            reservedByPendingOrder: false,
            now,
          },
        ],
        now,
      ),
    ).toBe(1);
  });
});
