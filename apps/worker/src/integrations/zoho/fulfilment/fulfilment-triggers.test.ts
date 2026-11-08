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

  it("is about the order for the order and fulfilment events", () => {
    for (const eventType of Object.keys(FULFILMENT_TRIGGER_KINDS).filter(
      (type) => FULFILMENT_TRIGGER_KINDS[type] === "order",
    )) {
      expect(fulfilmentTriggerOf({ eventType, aggregateId: "ord-1" })).toEqual({
        kind: "order",
        orderId: "ord-1",
      });
    }
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
