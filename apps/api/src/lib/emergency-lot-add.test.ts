import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import {
  emergencyAddPublishFailedError,
  nextLotNumberForSale,
  resolveLotNumberForEmergencyAdd,
  rollbackFailedEmergencyLotAdd,
} from "./emergency-lot-add.js";
import { LotError } from "./errors.js";

function mkSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "sale-1",
    title: "Sale",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "online",
    allowOnlineBidsBeforeGoLive: false,
    streamUrl: null,
    heroPresentation: "cover",
    heroVideoUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    startTime: new Date(),
    endTime: new Date(Date.now() + 86_400_000),
    previewStartTime: null,
    status: "active",
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mkLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    saleId: "sale-1",
    lotNumber: 2,
    sellerId: "s1",
    title: "Lot",
    description: "Desc",
    medium: null,
    dimensions: null,
    images: ["img.jpg"],
    categoryId: "cat-1",
    auctionType: "english",
    startingPrice: "1",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "1",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 0,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(Date.now() + 86_400_000),
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  };
}

describe("nextLotNumberForSale", () => {
  it("returns max lot number plus one", () => {
    expect(
      nextLotNumberForSale([
        mkLot({ lotNumber: 1 }),
        mkLot({ id: "lot-2", lotNumber: 7 }),
        mkLot({ id: "lot-3", lotNumber: null }),
      ]),
    ).toBe(8);
  });
});

describe("resolveLotNumberForEmergencyAdd", () => {
  it("keeps explicit lot number on live sales", () => {
    expect(
      resolveLotNumberForEmergencyAdd({
        sale: mkSale({ status: "active" }),
        requestedLotNumber: 42,
        inSaleLots: [mkLot({ lotNumber: 1 })],
      }),
    ).toBe(42);
  });

  it("auto-assigns on live sales when lot number omitted", () => {
    expect(
      resolveLotNumberForEmergencyAdd({
        sale: mkSale({ status: "scheduled" }),
        requestedLotNumber: null,
        inSaleLots: [mkLot({ lotNumber: 3 })],
      }),
    ).toBe(4);
  });

  it("does not auto-assign on draft sales", () => {
    expect(
      resolveLotNumberForEmergencyAdd({
        sale: mkSale({ status: "draft" }),
        requestedLotNumber: null,
        inSaleLots: [mkLot({ lotNumber: 3 })],
      }),
    ).toBeUndefined();
  });
});

describe("rollbackFailedEmergencyLotAdd", () => {
  it("clears sale association and cancels jobs", async () => {
    const lotRepo = {
      clearSaleId: vi.fn().mockResolvedValue(undefined),
    };
    const jobScheduler = { cancelLotJobs: vi.fn().mockResolvedValue(undefined) };
    await rollbackFailedEmergencyLotAdd(mkLot(), {
      lotRepo: lotRepo as never,
      jobScheduler: jobScheduler as never,
    });
    expect(jobScheduler.cancelLotJobs).toHaveBeenCalledWith("lot-1");
    expect(lotRepo.clearSaleId).toHaveBeenCalledWith("lot-1");
  });
});

describe("emergencyAddPublishFailedError", () => {
  it("always uses emergency_add_publish_failed code with meta", () => {
    const e = emergencyAddPublishFailedError(
      new LotError("Add at least one image before publishing this lot"),
      "lot-9",
      true,
    );
    expect(e.code).toBe("emergency_add_publish_failed");
    expect(e.meta).toEqual({ lotId: "lot-9", rolledBack: true });
  });

  it("preserves the original code from the underlying publish error in meta", () => {
    const e = emergencyAddPublishFailedError(
      new LotError("Stripe Connect required", 409, "connect_required"),
      "lot-9",
      true,
    );
    expect(e.code).toBe("emergency_add_publish_failed");
    expect(e.meta).toEqual({ lotId: "lot-9", rolledBack: true, originalCode: "connect_required" });
  });

  it("does not include originalCode in meta when underlying error has no code", () => {
    const e = emergencyAddPublishFailedError(new LotError("No images"), "lot-8", false);
    expect(e.meta).toEqual({ lotId: "lot-8", rolledBack: false });
    expect(e.meta).not.toHaveProperty("originalCode");
  });
});
