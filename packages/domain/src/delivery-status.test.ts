import { describe, expect, it } from "vitest";
import { DELIVERY_STATUSES, deliveryStatusOf } from "./delivery-status.js";
import type { FulfilmentFacts } from "./purchase-delivery-stage.js";

const shipping = (status: FulfilmentFacts["status"]): FulfilmentFacts => ({
  status,
  method: "shipping",
});

describe("deliveryStatusOf", () => {
  it("follows the quote until the work moves", () => {
    expect(deliveryStatusOf({ quote: "requested", fulfilment: null }).status).toBe("waiting");
    expect(deliveryStatusOf({ quote: "quoted", fulfilment: null }).status).toBe("quoted");
    expect(
      deliveryStatusOf({ quote: "accepted", fulfilment: shipping("awaiting_release") }).status,
    ).toBe("to_dispatch");
    expect(deliveryStatusOf({ quote: "accepted", fulfilment: shipping("released") }).status).toBe(
      "to_dispatch",
    );
  });

  it("is on the way once the courier has it, and delivered when it arrives", () => {
    expect(deliveryStatusOf({ quote: "accepted", fulfilment: shipping("in_transit") })).toEqual({
      status: "on_the_way",
      closedReason: null,
      awaitingPayment: false,
    });
    expect(deliveryStatusOf({ quote: "accepted", fulfilment: shipping("delivered") }).status).toBe(
      "delivered",
    );
  });

  it("closes a withdrawn request whatever the lot did next", () => {
    for (const fulfilment of [null, shipping("delivered"), shipping("in_transit")]) {
      expect(deliveryStatusOf({ quote: "withdrawn", fulfilment })).toEqual({
        status: "closed",
        closedReason: "withdrawn",
        awaitingPayment: false,
      });
    }
  });

  it("closes a delivery whose sale was cancelled, even once accepted", () => {
    expect(deliveryStatusOf({ quote: "accepted", fulfilment: shipping("cancelled") })).toEqual({
      status: "closed",
      closedReason: "cancelled",
      awaitingPayment: false,
    });
    expect(deliveryStatusOf({ quote: "requested", fulfilment: shipping("cancelled") }).status).toBe(
      "closed",
    );
  });

  it("flags an accepted delivery that is not paid yet", () => {
    expect(deliveryStatusOf({ quote: "accepted", fulfilment: null }).awaitingPayment).toBe(true);
    expect(
      deliveryStatusOf({ quote: "accepted", fulfilment: shipping("awaiting_payment") })
        .awaitingPayment,
    ).toBe(true);
    expect(
      deliveryStatusOf({ quote: "accepted", fulfilment: shipping("awaiting_release") })
        .awaitingPayment,
    ).toBe(false);
    // Only "Booked, not dispatched" carries the second badge.
    expect(deliveryStatusOf({ quote: "quoted", fulfilment: null }).awaitingPayment).toBe(false);
  });

  it("lists the statuses in the order of the view tabs", () => {
    expect(DELIVERY_STATUSES).toEqual([
      "waiting",
      "quoted",
      "to_dispatch",
      "on_the_way",
      "delivered",
      "closed",
    ]);
  });
});
