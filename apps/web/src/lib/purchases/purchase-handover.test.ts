import { describe, expect, it } from "vitest";
import { paidPurchaseHref, parsePaidLots, purchaseHandover } from "./purchase-handover";

describe("paidPurchaseHref", () => {
  it("opens the purchase and says how many lots the payment covered", () => {
    expect(paidPurchaseHref("lot-1", 3)).toBe("/purchases/lot-1?paid=3");
  });
});

describe("parsePaidLots", () => {
  it("reads a whole count of one to twenty and nothing else", () => {
    expect(parsePaidLots("1")).toBe(1);
    expect(parsePaidLots("20")).toBe(20);
    expect(parsePaidLots(["3", "9"])).toBe(3);
    for (const bad of [undefined, "", "0", "21", "-1", "1.5", "01", "abc", "1,2", " 2"]) {
      expect(parsePaidLots(bad)).toBeNull();
    }
  });
});

describe("purchaseHandover", () => {
  const base = {
    paidLots: 1,
    state: "choose-delivery" as const,
    canChooseDelivery: true,
    deliveryAnchor: "delivery",
  };

  it("says paid, and offers the choice of delivery while it is still to make", () => {
    expect(purchaseHandover(base)).toEqual({
      title: "Paid. Thank you.",
      detail: "We emailed your receipt. Next, choose how you receive the work.",
      action: { label: "Choose delivery", href: "#delivery" },
    });
  });

  it("points at the other lots when the payment covered several", () => {
    const vm = purchaseHandover({ ...base, paidLots: 3 });
    expect(vm?.detail).toBe(
      "We emailed your receipt for 3 lots. Next, choose how you receive this work; the others are in Purchases.",
    );
  });

  it("offers no choice to a member who does not pay for delivery", () => {
    expect(purchaseHandover({ ...base, canChooseDelivery: false })?.action).toBeNull();
  });

  it("only says thank you once delivery is under way, without asking for a choice", () => {
    const vm = purchaseHandover({ ...base, state: "preparing" });
    expect(vm).toEqual({
      title: "Paid. Thank you.",
      detail: "We emailed your receipt.",
      action: null,
    });
  });

  it("shows nothing without the address saying so, or for a purchase that is not paid", () => {
    expect(purchaseHandover({ ...base, paidLots: null })).toBeNull();
    for (const state of [
      "payment-due",
      "in-review",
      "payment-processing",
      "refunded",
      "cancelled",
    ] as const) {
      expect(purchaseHandover({ ...base, state })).toBeNull();
    }
  });
});
