import { listDomainEventTypesForConsumer } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { CrmGatewayError } from "../../../crm/crm-gateway-error.js";
import { LISTING_TRIGGER_EVENT_TYPES } from "./listing-triggers.js";
import { EMPTY_REPORT, type ListingSyncReport } from "./zoho-listing-sync.js";
import { ZohoListingWriteback } from "./zoho-listing-writeback.js";

const REGISTER = "6f1c1d0e-0000-4000-8000-000000000001";
const LOT = "7a2b3c4d-0000-4000-8000-000000000012";
const SALE = "8b000000-0000-4000-8000-000000000001";

function setup(
  report: Partial<ListingSyncReport> = { checked: 1, changed: 1 },
  mode: "dry_run" | "live" = "live",
) {
  const sync = vi.fn(async () => ({ ...EMPTY_REPORT, failures: [], ...report }));
  const sources = {
    registerIdsForLot: vi.fn(async () => [REGISTER]),
    registerIdsForSale: vi.fn(async () => [REGISTER, "another"]),
    registerIdsForLaxArtListing: vi.fn(async () => [REGISTER]),
  };
  return { writeback: new ZohoListingWriteback({ sync: { sync }, sources, mode }), sync, sources };
}

describe("listing triggers", () => {
  it("are exactly the events routed to the listing consumer", () => {
    expect([...listDomainEventTypesForConsumer("zoho_artwork_listing")].sort()).toEqual(
      [...LISTING_TRIGGER_EVENT_TYPES].sort(),
    );
  });
});

describe("ZohoListingWriteback", () => {
  it("refreshes the artwork a register move is about", async () => {
    const { writeback, sync } = setup();
    const result = await writeback.deliver({
      eventType: "artwork_register.offer_changed",
      aggregateId: REGISTER,
      payload: { registerId: REGISTER, toState: "sold" },
    });
    expect(sync).toHaveBeenCalledWith([REGISTER]);
    expect(result).toEqual({ outcome: "success", providerReference: "Products:1" });
  });

  it("refreshes every lot of a sale when one lot goes live, since the whole sale is live now", async () => {
    const { writeback, sync, sources } = setup();
    await writeback.deliver({
      eventType: "lot.activated",
      aggregateId: LOT,
      payload: { saleId: SALE, activatedAt: "2026-11-12T18:00:00Z" },
    });
    expect(sources.registerIdsForSale).toHaveBeenCalledWith(SALE);
    expect(sync).toHaveBeenCalledWith([REGISTER, "another"]);
  });

  it("refreshes the lot's artwork when a lot closes, and the sale's when a sale ends", async () => {
    const { writeback, sources } = setup();
    await writeback.deliver({ eventType: "lot.ended", aggregateId: LOT, payload: {} });
    expect(sources.registerIdsForLot).toHaveBeenCalledWith(LOT);
    await writeback.deliver({ eventType: "sale.ended", aggregateId: SALE, payload: {} });
    expect(sources.registerIdsForSale).toHaveBeenCalledWith(SALE);
  });

  it("skips an event with no artwork behind it, and one it does not handle", async () => {
    const { writeback, sources, sync } = setup();
    sources.registerIdsForLot.mockResolvedValueOnce([]);
    expect(
      await writeback.deliver({ eventType: "lot.published", aggregateId: LOT, payload: {} }),
    ).toEqual({
      outcome: "skipped",
      reason: "no_register_entry",
    });
    expect(await writeback.deliver({ eventType: "bid.placed", payload: {} })).toEqual({
      outcome: "skipped",
      reason: "event_type_not_handled",
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it("says already in sync, or dry run, when nothing was sent", async () => {
    const event = {
      eventType: "artwork_register.offer_changed",
      payload: { registerId: REGISTER },
    };
    expect(await setup({ checked: 1, unchanged: 1 }).writeback.deliver(event)).toEqual({
      outcome: "skipped",
      reason: "listing_already_in_sync",
    });
    expect(await setup({ checked: 1, stale: 1 }).writeback.deliver(event)).toEqual({
      outcome: "skipped",
      reason: "newer_listing_in_zoho",
    });
    expect(await setup({ checked: 1, changed: 1 }, "dry_run").writeback.deliver(event)).toEqual({
      outcome: "skipped",
      reason: "dry_run",
    });
  });

  it("retries a retryable failure and dead-letters one that cannot succeed", async () => {
    const event = {
      eventType: "artwork_register.offer_changed",
      payload: { registerId: REGISTER },
    };
    const failure = (retryable: boolean) => ({
      registerId: REGISTER,
      stockCode: "LAX-ORI-AR-PC-26-0001",
      code: retryable ? "TOO_MANY_REQUESTS" : "INVALID_DATA",
      retryable,
    });
    expect(
      (await setup({ checked: 1, failures: [failure(true)] }).writeback.deliver(event)).outcome,
    ).toBe("retry");
    expect(
      (await setup({ checked: 1, failures: [failure(false)] }).writeback.deliver(event)).outcome,
    ).toBe("fatal");
  });

  it("retries when Zoho or LAX Shop cannot be reached", async () => {
    const { writeback, sync } = setup();
    sync.mockRejectedValueOnce(
      new CrmGatewayError({
        code: "lax_art_unavailable",
        message: "x",
        status: 503,
        retryable: true,
      }),
    );
    const result = await writeback.deliver({
      eventType: "artwork_register.offer_changed",
      payload: { registerId: REGISTER },
    });
    expect(result.outcome).toBe("retry");
  });
});
