import { describe, expect, it, vi } from "vitest";
import {
  LISTING_TRIGGER_EVENT_TYPES,
  type ListingTriggerEvent,
  registerIdsFor,
} from "./listing-triggers.js";

const sources = () => ({
  registerIdsForLot: vi.fn(async () => ["lot-reg"]),
  registerIdsForSale: vi.fn(async () => ["reg-1", "reg-2"]),
  registerIdsForLaxArtListing: vi.fn(async () => []),
});

describe("sale.rescheduled", () => {
  const event: ListingTriggerEvent = {
    eventType: "sale.rescheduled",
    aggregateId: "sale-1",
    payload: {
      saleId: "sale-1",
      previousStartAt: "2026-11-12T18:00:00.000Z",
      newStartAt: "2026-11-12T18:30:00.000Z",
    },
  };

  it("is a listing trigger", () => {
    expect(LISTING_TRIGGER_EVENT_TYPES).toContain("sale.rescheduled");
  });

  it("refreshes every lot of the sale, whichever way the start moved", async () => {
    const s = sources();
    expect(await registerIdsFor(event, s)).toEqual(["reg-1", "reg-2"]);
    expect(s.registerIdsForSale).toHaveBeenCalledWith("sale-1");
  });
});

describe("lot.soft_deleted", () => {
  const event: ListingTriggerEvent = {
    eventType: "lot.soft_deleted",
    aggregateId: "lot-1",
    payload: {},
  };

  it("is a listing trigger", () => {
    expect(LISTING_TRIGGER_EVENT_TYPES).toContain("lot.soft_deleted");
  });

  it("refreshes the artwork the lot was on", async () => {
    const s = sources();
    expect(await registerIdsFor(event, s)).toEqual(["lot-reg"]);
    expect(s.registerIdsForLot).toHaveBeenCalledWith("lot-1");
  });
});
