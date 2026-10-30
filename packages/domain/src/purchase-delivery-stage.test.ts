import { describe, expect, it } from "vitest";
import { type PurchaseDeliveryFacts, purchaseDeliveryStage } from "./purchase-delivery-stage.js";

const facts = (over: Partial<PurchaseDeliveryFacts>): PurchaseDeliveryFacts => ({
  invoice: "paid",
  fulfilment: null,
  quote: null,
  ...over,
});

describe("purchaseDeliveryStage", () => {
  it("waits for payment before anything is arranged", () => {
    expect(purchaseDeliveryStage(facts({ invoice: "due" }))).toBe("awaiting_payment");
    expect(purchaseDeliveryStage(facts({ invoice: "overdue" }))).toBe("awaiting_payment");
  });

  it("asks a paid buyer to choose when nothing is chosen", () => {
    expect(purchaseDeliveryStage(facts({}))).toBe("choose");
  });

  it("follows the courier quote, even before payment", () => {
    expect(purchaseDeliveryStage(facts({ invoice: "due", quote: "requested" }))).toBe(
      "quote_requested",
    );
    expect(purchaseDeliveryStage(facts({ quote: "quoted" }))).toBe("quote_ready");
    expect(purchaseDeliveryStage(facts({ quote: "accepted" }))).toBe("booked");
  });

  it("goes back to choosing after a withdrawn quote", () => {
    expect(purchaseDeliveryStage(facts({ quote: "withdrawn" }))).toBe("choose");
  });

  it("shows collection being prepared, then ready", () => {
    const preparing = { status: "released" as const, method: "collection" as const };
    expect(purchaseDeliveryStage(facts({ fulfilment: preparing }))).toBe("preparing");
    const ready = { status: "ready_for_collection" as const, method: "collection" as const };
    expect(purchaseDeliveryStage(facts({ fulfilment: ready }))).toBe("ready_to_collect");
  });

  it("lets the moved work win over the quote", () => {
    const transit = { status: "in_transit" as const, method: "shipping" as const };
    expect(purchaseDeliveryStage(facts({ fulfilment: transit, quote: "accepted" }))).toBe(
      "in_transit",
    );
  });

  it("tells delivered from collected", () => {
    expect(
      purchaseDeliveryStage(facts({ fulfilment: { status: "delivered", method: "shipping" } })),
    ).toBe("delivered");
    expect(
      purchaseDeliveryStage(facts({ fulfilment: { status: "delivered", method: "collection" } })),
    ).toBe("collected");
  });

  it("is cancelled once the purchase is refunded or cancelled", () => {
    expect(purchaseDeliveryStage(facts({ invoice: "refunded", quote: "accepted" }))).toBe(
      "cancelled",
    );
    expect(
      purchaseDeliveryStage(facts({ fulfilment: { status: "cancelled", method: null } })),
    ).toBe("cancelled");
  });
});
