import type { PaymentStatus } from "@auction/types";
import { describe, expect, it } from "vitest";
import { purchaseEnding, purchaseIsOwned, purchaseIsToPay } from "./purchase-state.js";

describe("purchaseEnding", () => {
  it.each([
    [null, null, null],
    ["pending", null, null],
    ["captured", "released", null],
    ["refunded", null, "refunded"],
    ["cancelled", null, "cancelled"],
    ["pending", "cancelled", "cancelled"],
    ["captured", "cancelled", "cancelled"],
  ] as const)("payment %s, fulfilment %s: %s", (paymentStatus, fulfilmentStatus, ending) => {
    expect(purchaseEnding({ paymentStatus, fulfilmentStatus })).toBe(ending);
  });
});

describe("purchaseIsToPay", () => {
  it.each<[PaymentStatus | null, boolean]>([
    [null, true],
    ["pending", true],
    ["requires_manual_review", true],
    ["authorized", false],
    ["captured", false],
    ["refunded", false],
    ["cancelled", false],
  ])("payment %s: %s", (paymentStatus, owed) => {
    expect(purchaseIsToPay({ paymentStatus })).toBe(owed);
  });

  it("is never owed once delivery was cancelled", () => {
    expect(purchaseIsToPay({ paymentStatus: "pending", fulfilmentStatus: "cancelled" })).toBe(
      false,
    );
  });
});

describe("purchaseIsOwned", () => {
  it("owns a paid purchase", () => {
    expect(purchaseIsOwned({ invoice: "paid", deliveryStage: "choose" })).toBe(true);
    expect(purchaseIsOwned({ invoice: "paid", deliveryStage: "collected" })).toBe(true);
  });

  it.each(["not_invoiced", "due", "overdue", "processing", "refunded", "cancelled"] as const)(
    "does not own a purchase that is %s",
    (invoice) => {
      expect(purchaseIsOwned({ invoice, deliveryStage: "awaiting_payment" })).toBe(false);
    },
  );

  it("does not own a paid purchase whose delivery was cancelled", () => {
    expect(purchaseIsOwned({ invoice: "paid", deliveryStage: "cancelled" })).toBe(false);
  });
});
