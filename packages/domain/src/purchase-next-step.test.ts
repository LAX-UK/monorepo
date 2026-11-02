import { describe, expect, it } from "vitest";
import { type PurchaseNextStepFacts, purchaseNextStep } from "./purchase-next-step.js";

const facts = (overrides: Partial<PurchaseNextStepFacts>): PurchaseNextStepFacts => ({
  paymentStatus: "captured",
  fulfilment: null,
  shippingQuote: null,
  ...overrides,
});

const fulfilment = (
  status: NonNullable<PurchaseNextStepFacts["fulfilment"]>["status"],
  method: "collection" | "shipping" | null = null,
  collectedAt: Date | null = null,
) => ({ status, method, collectedAt });

describe("purchaseNextStep", () => {
  it.each([null, "pending", "requires_manual_review"] as const)(
    "payment %s: still to pay",
    (paymentStatus) => {
      expect(purchaseNextStep(facts({ paymentStatus }))).toBe("pay");
    },
  );

  it.each(["authorized", "refunded", "cancelled"] as const)(
    "payment %s: nothing for the buyer",
    (status) => {
      expect(purchaseNextStep(facts({ paymentStatus: status }))).toBeNull();
    },
  );

  it("an unpaid purchase whose delivery was cancelled is not to pay", () => {
    expect(
      purchaseNextStep(facts({ paymentStatus: "pending", fulfilment: fulfilment("cancelled") })),
    ).toBeNull();
  });

  it("paid with no delivery chosen: choose delivery", () => {
    expect(purchaseNextStep(facts({}))).toBe("choose_delivery");
    expect(purchaseNextStep(facts({ fulfilment: fulfilment("released") }))).toBe("choose_delivery");
  });

  it("a method chosen and being prepared: nothing to do", () => {
    expect(purchaseNextStep(facts({ fulfilment: fulfilment("released", "shipping") }))).toBeNull();
  });

  it("a courier quote waiting: answer it", () => {
    expect(
      purchaseNextStep(facts({ fulfilment: fulfilment("released"), shippingQuote: "ready" })),
    ).toBe("quote_ready");
  });

  it("ready to collect: book collection, until collected", () => {
    expect(
      purchaseNextStep(facts({ fulfilment: fulfilment("ready_for_collection", "collection") })),
    ).toBe("book_collection");
    expect(
      purchaseNextStep(
        facts({ fulfilment: fulfilment("ready_for_collection", "collection", new Date()) }),
      ),
    ).toBeNull();
  });

  it.each(["in_transit", "delivered", "cancelled"] as const)("%s: done or with LAX", (status) => {
    expect(purchaseNextStep(facts({ fulfilment: fulfilment(status, "shipping") }))).toBeNull();
  });
});
