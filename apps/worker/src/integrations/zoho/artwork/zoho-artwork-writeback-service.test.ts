import type { ArtworkRegisterEntry, OfferState } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
import { NOW, REGISTER_ID, entry, fakeWorld } from "../../../testing/zoho-status-fakes.js";
import { CrmGatewayError } from "../../crm/crm-gateway-error.js";
import { assessProduct } from "./assess-product.js";
import type { CatalogueProduct } from "./catalogue-product.js";
import { decideArtworkOutcome } from "./decide-outcome.js";
import { product } from "./fixtures/load-fixtures.js";
import type { ZohoProductState } from "./writeback-mapping.js";
import {
  OFFER_CHANGED_EVENT,
  STOCK_CODE_ASSIGNED_EVENT,
  type ZohoArtworkWritebackMode,
  ZohoArtworkWritebackService,
} from "./zoho-artwork-writeback-service.js";

function offerEvent(toState: OfferState = "bid_sale") {
  return {
    id: 1,
    eventType: OFFER_CHANGED_EVENT,
    payload: { schemaVersion: 1, registerId: REGISTER_ID, toState },
  };
}

const stockCodeEvent = {
  id: 2,
  eventType: STOCK_CODE_ASSIGNED_EVENT,
  payload: { schemaVersion: 1, registerId: REGISTER_ID },
};

/**
 * The service over a Zoho Product and a register held in memory. The Status goes through the real
 * compare-and-set (`ZohoStatusSync`); only Zoho and the register are fakes.
 */
function setup(
  mode: ZohoArtworkWritebackMode,
  options: {
    entry?: ArtworkRegisterEntry | null;
    stockCode?: string | null;
    zohoStatus?: string | null;
    written?: string | null;
    zohoGone?: boolean;
  } = {},
) {
  const held = options.entry === undefined ? entry() : options.entry;
  const world = fakeWorld({
    zohoStatus: options.zohoStatus === undefined ? "Available" : options.zohoStatus,
    written: options.written ?? null,
    source: held ? { entry: held, lastMove: null } : null,
    ...(options.zohoGone ? { zoho: undefined } : {}),
  });
  const zoho: ZohoProductState = { stockCode: options.stockCode ?? null };
  const products = {
    read: vi.fn(async () => zoho),
    update: vi.fn(async () => undefined),
  };
  const register = { findById: vi.fn(async () => world.world.source?.entry ?? null) };
  const service = new ZohoArtworkWritebackService({
    mode,
    products,
    register,
    status: world.sync(mode === "dry_run" ? "dry_run" : "live"),
    sources: world.sources,
    log: world.log as never,
    now: () => NOW,
  });
  return {
    service,
    products,
    register,
    log: world.log,
    status: world.products,
    recorded: world.register,
    world: world.world,
    held: () => world.world.source?.entry ?? null,
  };
}

describe("ZohoArtworkWritebackService prints that came in from Zoho", () => {
  it("still writes them: a LAX-PRI Product is a Product, with no original behind it", async () => {
    const { service, products } = setup("live", {
      entry: entry({ kind: "print", stockCode: "LAX-PRI-PH-GAC-26-0001", sourceOriginalId: null }),
    });
    expect((await service.deliver(stockCodeEvent)).outcome).toBe("success");
    expect(products.update).toHaveBeenCalledWith("5000000000001000001", {
      Reference_Stock_Code: "LAX-PRI-PH-GAC-26-0001",
    });
  });
});

describe("ZohoArtworkWritebackService print groups", () => {
  it("leaves a print group alone: its code lives in Print_Group_ID, on a Print_Products record", async () => {
    for (const mode of ["dry_run", "live"] as const) {
      const { service, products, status, recorded, log } = setup(mode, {
        entry: entry({ kind: "print", stockCode: "LAX-PRT-PH-GAC-26-0001", sourceOriginalId: "o" }),
      });
      for (const event of [stockCodeEvent, offerEvent()]) {
        expect(await service.deliver(event)).toEqual({
          outcome: "skipped",
          reason: "print_group_not_a_product",
        });
      }
      expect(products.read).not.toHaveBeenCalled();
      expect(products.update).not.toHaveBeenCalled();
      expect(status.read).not.toHaveBeenCalled();
      expect(recorded.recordCatalogueStatusWritten).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
    }
  });
});

describe("ZohoArtworkWritebackService modes", () => {
  it("off does nothing and never reads the register or Zoho", async () => {
    const { service, products, register, status } = setup("off");
    expect(await service.deliver(offerEvent())).toEqual({
      outcome: "skipped",
      reason: "writeback_off",
    });
    expect(register.findById).not.toHaveBeenCalled();
    expect(products.read).not.toHaveBeenCalled();
    expect(status.read).not.toHaveBeenCalled();
    expect(status.write).not.toHaveBeenCalled();
  });

  it("dry run logs the Status that would be sent and never calls Zoho", async () => {
    const { service, products, status, recorded, log } = setup("dry_run", {
      entry: entry({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "lot-1" } } }),
    });
    expect(await service.deliver(offerEvent())).toEqual({ outcome: "skipped", reason: "dry_run" });
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({
        zohoProductId: "5000000000001000001",
        fields: { Status: "In Auction" },
      }),
      "zoho_artwork_writeback_dry_run",
    );
    expect(products.read).not.toHaveBeenCalled();
    expect(status.read).not.toHaveBeenCalled();
    expect(status.write).not.toHaveBeenCalled();
    expect(recorded.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });

  it("dry run logs the stock code for an assignment", async () => {
    const { service, products, log } = setup("dry_run");
    await service.deliver(stockCodeEvent);
    expect(log.info).toHaveBeenCalledWith(
      expect.objectContaining({ fields: { Reference_Stock_Code: "LAX-ORI-PH-GAC-26-0001" } }),
      "zoho_artwork_writeback_dry_run",
    );
    expect(products.update).not.toHaveBeenCalled();
  });
});

describe("ZohoArtworkWritebackService live: the Status", () => {
  it("writes the Status for the register's current place, not the event's", async () => {
    // The event says bid_sale, but the artwork has since been sold: the write follows the register.
    const { service, status } = setup("live", {
      entry: entry({ offer: { state: "sold", ref: null } }),
    });
    expect(await service.deliver(offerEvent("bid_sale"))).toEqual({
      outcome: "success",
      providerReference: "Products:5000000000001000001",
    });
    expect(status.write).toHaveBeenCalledWith("5000000000001000001", "Sold");
  });

  it("writes only the Status for an offer change", async () => {
    const { service, status, products } = setup("live", {
      entry: entry({ offer: { state: "private_sale", ref: null } }),
    });
    await service.deliver(offerEvent("private_sale"));
    expect(status.write).toHaveBeenCalledTimes(1);
    expect(status.write).toHaveBeenCalledWith("5000000000001000001", "Reserved");
    expect(products.update).not.toHaveBeenCalled();
  });

  it("does not write over a Sold or Reserved that staff set, and raises a conflict instead", async () => {
    for (const staffStatus of ["Sold", "Reserved"]) {
      const { service, status, world, recorded } = setup("live", {
        entry: entry({ offer: { state: "withdrawn", ref: null } }),
        zohoStatus: staffStatus,
        written: "Available",
      });
      expect(await service.deliver(offerEvent("withdrawn"))).toEqual({
        outcome: "skipped",
        reason: "status_conflict_raised",
      });
      expect(status.write).not.toHaveBeenCalled();
      expect(recorded.recordCatalogueStatusWritten).not.toHaveBeenCalled();
      expect(world.conflict).toEqual({ zohoStatus: staffStatus, laxStatus: "Withdrawn" });
    }
  });

  it("writes when Zoho still shows the Status LAX wrote", async () => {
    const { service, status } = setup("live", {
      entry: entry({ offer: { state: "sold", ref: null } }),
      zohoStatus: "In Auction",
      written: "In Auction",
    });
    expect((await service.deliver(offerEvent("sold"))).outcome).toBe("success");
    expect(status.write).toHaveBeenCalledWith("5000000000001000001", "Sold");
  });

  it("is idempotent: Zoho already holding the value means no write", async () => {
    const { service, status, products } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
      zohoStatus: "In Auction",
      stockCode: "LAX-ORI-PH-GAC-26-0001",
    });
    expect(await service.deliver(offerEvent())).toEqual({
      outcome: "skipped",
      reason: "status_already_in_sync",
    });
    expect(await service.deliver(stockCodeEvent)).toEqual({
      outcome: "skipped",
      reason: "stock_code_already_in_sync",
    });
    expect(status.write).not.toHaveBeenCalled();
    expect(products.update).not.toHaveBeenCalled();
  });

  it("delivering the same event twice sends one update", async () => {
    const { service, status } = setup("live", {
      entry: entry({ offer: { state: "sold", ref: null } }),
    });
    await service.deliver(offerEvent("sold"));
    await service.deliver(offerEvent("sold"));
    expect(status.write).toHaveBeenCalledTimes(1);
  });

  it("retries, rather than writing, when Zoho changed while the Status was compared", async () => {
    const { service, status, world } = setup("live", {
      entry: entry({ offer: { state: "sold", ref: null } }),
    });
    world.zoho = { status: "Available", modifiedAt: new Date("2026-11-03T12:00:10.000Z") };
    const result = await service.deliver(offerEvent("sold"));
    expect(result.outcome).toBe("retry");
    expect(status.write).not.toHaveBeenCalled();
  });
});

describe("ZohoArtworkWritebackService live: the stock code and events", () => {
  it("writes only the stock code for an assignment", async () => {
    const { service, products, status } = setup("live");
    const result = await service.deliver(stockCodeEvent);
    expect(result.outcome).toBe("success");
    expect(products.update).toHaveBeenCalledWith("5000000000001000001", {
      Reference_Stock_Code: "LAX-ORI-PH-GAC-26-0001",
    });
    expect(status.write).not.toHaveBeenCalled();
  });

  it("skips an event whose register entry is gone", async () => {
    const { service, products, status } = setup("live", { entry: null });
    expect(await service.deliver(offerEvent())).toEqual({
      outcome: "skipped",
      reason: "register_entry_missing",
    });
    expect(products.read).not.toHaveBeenCalled();
    expect(status.read).not.toHaveBeenCalled();
  });

  it("skips an event type it does not handle and a payload without a register id", async () => {
    const { service, products } = setup("live");
    expect(
      (
        await service.deliver({
          eventType: "user.registered",
          payload: { registerId: REGISTER_ID },
        })
      ).outcome,
    ).toBe("skipped");
    expect(await service.deliver({ eventType: OFFER_CHANGED_EVENT, payload: {} })).toEqual({
      outcome: "skipped",
      reason: "payload_without_register_id",
    });
    expect(products.read).not.toHaveBeenCalled();
  });
});

describe("ZohoArtworkWritebackService failures", () => {
  it("dead-letters, as a fatal result, a Product Zoho no longer has", async () => {
    const { service, status } = setup("live", { zohoGone: true });
    const result = await service.deliver(offerEvent());
    expect(result.outcome).toBe("fatal");
    expect(result.outcome === "fatal" && (result.error as CrmGatewayError).code).toBe(
      "product_not_found",
    );
    expect(status.write).not.toHaveBeenCalled();
  });

  it("retries when Zoho fails in a way that may pass", async () => {
    const { service, status } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
    });
    status.write.mockRejectedValue(
      new CrmGatewayError({
        code: "TOO_MANY_REQUESTS",
        message: "slow down",
        status: 429,
        retryable: true,
      }),
    );
    expect((await service.deliver(offerEvent())).outcome).toBe("retry");
  });

  it("is fatal when Zoho refuses the data", async () => {
    const { service, status } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
    });
    status.write.mockRejectedValue(
      new CrmGatewayError({
        code: "INVALID_DATA",
        message: "bad pick",
        status: 400,
        retryable: false,
      }),
    );
    expect((await service.deliver(offerEvent())).outcome).toBe("fatal");
  });

  it("does not note a Status in the register when the write failed", async () => {
    const { service, status, recorded } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
    });
    status.write.mockRejectedValue(new Error("boom"));
    await service.deliver(offerEvent());
    expect(recorded.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });
});

describe("echo protection", () => {
  /** The Zoho Product as the inbound sync would read it back after LAX's write. */
  function echoed(statusValue: string, modifiedAt: Date): CatalogueProduct {
    return { ...product(1), status: statusValue, modifiedAt };
  }

  it("makes the change that comes back through the inbound sync read as unchanged", async () => {
    const before = entry({ offer: { state: "bid_sale", ref: { kind: "bid_lot", id: "lot-1" } } });
    const { service, held } = setup("live", { entry: before });

    await service.deliver(offerEvent());
    const after = held();
    if (!after) throw new Error("entry missing");
    expect(after.catalogueStatus).toBe("In Auction");

    const decision = decideArtworkOutcome(
      assessProduct(echoed("In Auction", new Date("2026-11-03T12:00:01.000Z"))),
      { existing: after, holderOfStockCode: null },
    );
    expect(decision).toMatchObject({ outcome: "unchanged", conflicts: [] });
  });

  it("without the register noting the write, the same echo would look like a Zoho change", () => {
    const before = entry({ offer: { state: "bid_sale", ref: null } });
    const decision = decideArtworkOutcome(
      assessProduct(echoed("In Auction", new Date("2026-11-03T12:00:01.000Z"))),
      { existing: before, holderOfStockCode: null },
    );
    expect(decision.outcome).toBe("update");
  });

  it("leaves the register copy to the inbound sync when Zoho already held the value", async () => {
    const { service, held } = setup("live", {
      entry: entry({ catalogueStatus: "Available", offer: { state: "sold", ref: null } }),
      zohoStatus: "Sold",
    });
    await service.deliver(offerEvent("sold"));
    // LAX sent nothing, so it records nothing as its own write; the inbound sync copies Zoho's value.
    expect(held()?.catalogueStatus).toBe("Available");
  });

  it("still reports a real Zoho edit made alongside the echo", async () => {
    const before = entry({ offer: { state: "bid_sale", ref: null } });
    const { service, held } = setup("live", { entry: before });
    await service.deliver(offerEvent());
    const after = held();
    if (!after) throw new Error("entry missing");

    const edited = {
      ...echoed("In Auction", new Date("2026-11-03T12:00:01.000Z")),
      medium: "Gouache",
    };
    const decision = decideArtworkOutcome(assessProduct(edited), {
      existing: after,
      holderOfStockCode: null,
    });
    expect(decision.outcome).toBe("update");
    expect(Object.keys(decision.changes)).toEqual(["medium"]);
  });
});
