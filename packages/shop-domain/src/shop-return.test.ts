import { describe, expect, it } from "vitest";
import { SHOP_FULFILMENT_STATUSES } from "./fulfilment-state.js";
import {
  SHOP_RETURN_STATUSES,
  canTransitionReturn,
  cancellationStockOutcome,
  isShopReturnDisposition,
  isShopReturnStatus,
  listingAfterReturn,
  nextReturnStatuses,
} from "./shop-return.js";

describe("return transitions", () => {
  it("moves requested to in transit to received, one step at a time", () => {
    expect(canTransitionReturn("requested", "in_transit")).toBe(true);
    expect(canTransitionReturn("in_transit", "received")).toBe(true);
    expect(canTransitionReturn("requested", "received")).toBe(false);
  });

  it("never moves backwards or out of a final status", () => {
    expect(canTransitionReturn("in_transit", "requested")).toBe(false);
    for (const from of ["received", "cancelled"] as const) {
      for (const to of SHOP_RETURN_STATUSES) expect(canTransitionReturn(from, to)).toBe(false);
    }
  });

  it("lists exactly the moves the rule allows", () => {
    for (const from of SHOP_RETURN_STATUSES) {
      const allowed = SHOP_RETURN_STATUSES.filter((to) => canTransitionReturn(from, to));
      expect([...nextReturnStatuses(from)]).toEqual(allowed);
    }
  });

  it("recognises known values only", () => {
    expect(isShopReturnStatus("received")).toBe(true);
    expect(isShopReturnStatus("lost")).toBe(false);
    expect(isShopReturnDisposition("back_on_sale")).toBe(true);
    expect(isShopReturnDisposition("scrapped")).toBe(false);
  });
});

describe("stock after a cancellation", () => {
  it.each(["in_transit", "delivered", "collected"] as const)(
    "waits for the return when the item is %s",
    (status) => {
      expect(cancellationStockOutcome(status)).toBe("await_return");
    },
  );

  it.each(
    SHOP_FULFILMENT_STATUSES.filter((s) => !["in_transit", "delivered", "collected"].includes(s)),
  )("restocks at once when the item is %s", (status) => {
    expect(cancellationStockOutcome(status)).toBe("restock_now");
  });
});

describe("listing after a return", () => {
  it("puts an undamaged item back on sale and withdraws a damaged one", () => {
    expect(listingAfterReturn("back_on_sale")).toBe("authorised");
    expect(listingAfterReturn("withdrawn_damaged")).toBe("withdrawn");
  });
});
