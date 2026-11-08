import type { ArtworkRegisterEntry, OfferState } from "@auction/artwork-register-contracts";
import { describe, expect, it, vi } from "vitest";
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

const NOW = new Date("2026-11-03T12:00:00.000Z");
const REGISTER_ID = "6f1c1d0e-0000-4000-8000-000000000001";

function entry(overrides: Partial<ArtworkRegisterEntry> = {}): ArtworkRegisterEntry {
  return {
    id: REGISTER_ID,
    zohoProductId: "5000000000001000001",
    stockCode: "LAX-ORI-PH-GAC-26-0001",
    kind: "original",
    sourceOriginalId: null,
    title: "Harbour at dusk",
    artist: { zohoArtistId: "5000000000000077001", name: "Aidan Phelan", code: "PH" },
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    year: 2024,
    imageRefs: [],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
    zohoModifiedAt: new Date("2026-09-01T00:00:00.000Z"),
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    ...overrides,
  };
}

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

function setup(
  mode: ZohoArtworkWritebackMode,
  options: { entry?: ArtworkRegisterEntry | null; zoho?: ZohoProductState | null } = {},
) {
  let held: ArtworkRegisterEntry | null = options.entry === undefined ? entry() : options.entry;
  const zoho: ZohoProductState | null =
    options.zoho === undefined ? { status: "Available", stockCode: null } : options.zoho;
  const products = {
    read: vi.fn(async () => zoho),
    update: vi.fn(async () => undefined),
  };
  const register = {
    findById: vi.fn(async () => held),
    recordCatalogueStatusWritten: vi.fn(
      async (input: { registerId: string; status: string; now: Date }) => {
        if (!held) return { status: "not_found" as const };
        if (held.catalogueStatus === input.status) return { status: "unchanged" as const };
        held = { ...held, catalogueStatus: input.status };
        return { status: "recorded" as const };
      },
    ),
  };
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  const service = new ZohoArtworkWritebackService({
    mode,
    products,
    register,
    log: log as never,
    now: () => NOW,
  });
  return {
    service,
    products,
    register,
    log,
    held: () => held,
  };
}

describe("ZohoArtworkWritebackService print groups", () => {
  it("leaves a print group alone: its code lives in Print_Group_ID, on a Print_Products record", async () => {
    for (const mode of ["dry_run", "live"] as const) {
      const { service, products, register, log } = setup(mode, {
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
      expect(register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
      expect(log.info).not.toHaveBeenCalled();
    }
  });
});

describe("ZohoArtworkWritebackService modes", () => {
  it("off does nothing and never reads the register or Zoho", async () => {
    const { service, products, register } = setup("off");
    expect(await service.deliver(offerEvent())).toEqual({
      outcome: "skipped",
      reason: "writeback_off",
    });
    expect(register.findById).not.toHaveBeenCalled();
    expect(products.read).not.toHaveBeenCalled();
    expect(products.update).not.toHaveBeenCalled();
  });

  it("dry run logs the update that would be sent and never calls Zoho", async () => {
    const { service, products, register, log } = setup("dry_run", {
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
    expect(products.update).not.toHaveBeenCalled();
    expect(register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
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

describe("ZohoArtworkWritebackService live", () => {
  it("writes the Status for the register's current place, not the event's", async () => {
    // The event says bid_sale, but the artwork has since been sold: the write follows the register.
    const { service, products } = setup("live", {
      entry: entry({ offer: { state: "sold", ref: null } }),
    });
    const result = await service.deliver(offerEvent("bid_sale"));
    expect(result).toEqual({
      outcome: "success",
      providerReference: "Products:5000000000001000001",
    });
    expect(products.update).toHaveBeenCalledWith("5000000000001000001", { Status: "Sold" });
  });

  it("writes only the Status for an offer change", async () => {
    const { service, products } = setup("live", {
      entry: entry({ offer: { state: "private_sale", ref: null } }),
    });
    await service.deliver(offerEvent("private_sale"));
    expect(products.update).toHaveBeenCalledTimes(1);
    expect(products.update).toHaveBeenCalledWith("5000000000001000001", { Status: "Reserved" });
  });

  it("writes only the stock code for an assignment", async () => {
    const { service, products } = setup("live", { zoho: { status: "Available", stockCode: null } });
    const result = await service.deliver(stockCodeEvent);
    expect(result.outcome).toBe("success");
    expect(products.update).toHaveBeenCalledWith("5000000000001000001", {
      Reference_Stock_Code: "LAX-ORI-PH-GAC-26-0001",
    });
  });

  it("is idempotent: Zoho already holding the value means no write", async () => {
    const { service, products } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
      zoho: { status: "In Auction", stockCode: "LAX-ORI-PH-GAC-26-0001" },
    });
    expect(await service.deliver(offerEvent())).toEqual({
      outcome: "skipped",
      reason: "status_already_in_sync",
    });
    expect(await service.deliver(stockCodeEvent)).toEqual({
      outcome: "skipped",
      reason: "stock_code_already_in_sync",
    });
    expect(products.update).not.toHaveBeenCalled();
  });

  it("delivering the same event twice sends one update", async () => {
    const { service, products } = setup("live", {
      entry: entry({ offer: { state: "sold", ref: null } }),
    });
    await service.deliver(offerEvent("sold"));
    // After the first write Zoho holds the value.
    products.read.mockResolvedValue({ status: "Sold", stockCode: null });
    await service.deliver(offerEvent("sold"));
    expect(products.update).toHaveBeenCalledTimes(1);
  });

  it("skips an event whose register entry is gone", async () => {
    const { service, products } = setup("live", { entry: null });
    expect(await service.deliver(offerEvent())).toEqual({
      outcome: "skipped",
      reason: "register_entry_missing",
    });
    expect(products.read).not.toHaveBeenCalled();
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
    const { service, products } = setup("live", { zoho: null });
    const result = await service.deliver(offerEvent());
    expect(result.outcome).toBe("fatal");
    expect(result.outcome === "fatal" && (result.error as CrmGatewayError).code).toBe(
      "product_not_found",
    );
    expect(products.update).not.toHaveBeenCalled();
  });

  it("retries when Zoho fails in a way that may pass", async () => {
    const { service, products } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
    });
    products.update.mockRejectedValue(
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
    const { service, products } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
    });
    products.update.mockRejectedValue(
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
    const { service, products, register } = setup("live", {
      entry: entry({ offer: { state: "bid_sale", ref: null } }),
    });
    products.update.mockRejectedValue(new Error("boom"));
    await service.deliver(offerEvent());
    expect(register.recordCatalogueStatusWritten).not.toHaveBeenCalled();
  });
});

describe("echo protection", () => {
  /** The Zoho Product as the inbound sync would read it back after LAX's write. */
  function echoed(status: string, modifiedAt: Date): CatalogueProduct {
    return { ...product(1), status, modifiedAt };
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

  it("notes the register copy even when Zoho already held the value", async () => {
    const { service, held } = setup("live", {
      entry: entry({ catalogueStatus: "Available", offer: { state: "sold", ref: null } }),
      zoho: { status: "Sold", stockCode: null },
    });
    await service.deliver(offerEvent("sold"));
    expect(held()?.catalogueStatus).toBe("Sold");
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
