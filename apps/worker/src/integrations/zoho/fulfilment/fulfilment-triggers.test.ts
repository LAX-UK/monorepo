import { describe, expect, it } from "vitest";
import { FULFILMENT_TRIGGER_KINDS, fulfilmentTriggerOf } from "./fulfilment-triggers.js";

describe("fulfilmentTriggerOf", () => {
  it("is about the prints listing for the events that change a print group", () => {
    for (const eventType of ["shop.editions.allocated", "shop.artwork.updated"]) {
      expect(fulfilmentTriggerOf({ eventType, aggregateId: "art-1" })).toEqual({
        kind: "group",
        artworkId: "art-1",
      });
    }
  });

  it("is about the order in the payload for the order and fulfilment events", () => {
    for (const eventType of Object.keys(FULFILMENT_TRIGGER_KINDS).filter(
      (type) => FULFILMENT_TRIGGER_KINDS[type] === "order",
    )) {
      // The aggregate may be a line or the fulfilment; the payload always names the order.
      expect(
        fulfilmentTriggerOf({ eventType, aggregateId: "line-1", payload: { orderId: "ord-1" } }),
      ).toEqual({ kind: "order", orderId: "ord-1" });
    }
  });

  it("hears a framing task moving, so a finished frame is not left Queued in Zoho", () => {
    expect(
      fulfilmentTriggerOf({
        eventType: "shop.framing.status_changed",
        aggregateId: "task-1",
        payload: { orderId: "ord-1", orderLineId: "line-1" },
      }),
    ).toEqual({ kind: "order", orderId: "ord-1" });
  });

  it("ignores an order event whose payload names no order", () => {
    const eventType = "shop.fulfilment.dispatched";
    expect(fulfilmentTriggerOf({ eventType, aggregateId: "ful-1" })).toBeNull();
    expect(fulfilmentTriggerOf({ eventType, payload: { orderId: 7 } })).toBeNull();
    expect(fulfilmentTriggerOf({ eventType, payload: { orderId: " " } })).toBeNull();
  });

  it("ignores other events and events with no id", () => {
    expect(fulfilmentTriggerOf({ eventType: "lot.created", aggregateId: "x" })).toBeNull();
    expect(fulfilmentTriggerOf({ eventType: "shop.artwork.updated" })).toBeNull();
    expect(fulfilmentTriggerOf({ eventType: "shop.artwork.updated", aggregateId: " " })).toBeNull();
  });

  it("covers every event the catalogue routes to the fulfilment consumer", async () => {
    const { listDomainEventTypesForConsumer } = await import("@auction/types");
    expect([...listDomainEventTypesForConsumer("zoho_fulfilment")].sort()).toEqual(
      Object.keys(FULFILMENT_TRIGGER_KINDS).sort(),
    );
  });
});
