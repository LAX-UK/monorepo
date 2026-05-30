import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { LotError } from "../lib/errors.js";
import { listLotSoftDeleteBlockers, validateLotSoftDelete } from "./lot-soft-delete.policy.js";

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "l1",
    saleId: null,
    lotNumber: 1,
    title: "Vase",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    categoryId: "",
    auctionType: "english",
    startingPrice: "100",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: new Date(),
    endTime: new Date(),
    status: "draft",
    winnerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    marketingDetails: {},
    ...overrides,
  } as Lot;
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    title: "Evening",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "online",
    streamUrl: null,
    locationName: null,
    locationAddress: null,
    locationMapUrl: null,
    locationAddressLine1: null,
    locationAddressLine2: null,
    locationCity: null,
    locationCounty: null,
    locationPostcode: null,
    locationCountry: null,
    status: "draft",
    startTime: new Date(),
    endTime: new Date(),
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("validateLotSoftDelete", () => {
  it("allows draft standalone lot with no activity", () => {
    const result = validateLotSoftDelete({
      lot: lot(),
      sale: null,
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isOk()).toBe(true);
  });

  it("rejects active lot", () => {
    const result = validateLotSoftDelete({
      lot: lot({ status: "active" }),
      sale: null,
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("rejects when parent sale is live", () => {
    const result = validateLotSoftDelete({
      lot: lot({ saleId: "s1", status: "scheduled" }),
      sale: sale({ status: "active" }),
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("rejects when lot has bids", () => {
    const result = validateLotSoftDelete({
      lot: lot(),
      sale: null,
      guards: { bidCount: 1, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("rejects already deleted lot", () => {
    const result = validateLotSoftDelete({
      lot: lot({ deletedAt: new Date() }),
      sale: null,
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(LotError);
  });

  it("lists blockers for UI eligibility", () => {
    const blockers = listLotSoftDeleteBlockers({
      lot: lot({ status: "scheduled", saleId: "s1" }),
      sale: sale({ status: "scheduled" }),
      guards: { bidCount: 1, paymentCount: 0, approvedRegistrationCount: 1 },
    });
    expect(blockers).toEqual([
      "This lot has bids",
      "Parent sale has approved bidder registrations",
    ]);
  });
});
