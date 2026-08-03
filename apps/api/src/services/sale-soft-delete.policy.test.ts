import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { LotError } from "../lib/errors.js";
import { listSaleSoftDeleteBlockers, validateSaleSoftDelete } from "./sale-soft-delete.policy.js";

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s1",
    title: "Evening",
    description: null,
    coverImages: [],
    categoryId: null,
    deliveryMode: "onsite",
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

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "l1",
    saleId: "s1",
    lotNumber: 1,
    title: "Lot",
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

describe("validateSaleSoftDelete", () => {
  it("allows draft sale with draft lots and no activity", () => {
    const result = validateSaleSoftDelete({
      sale: sale(),
      lots: [lot()],
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isOk()).toBe(true);
  });

  it("rejects already deleted sale", () => {
    const result = validateSaleSoftDelete({
      sale: sale({ deletedAt: new Date() }),
      lots: [],
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error).toBeInstanceOf(LotError);
  });

  it("rejects active sale", () => {
    const result = validateSaleSoftDelete({
      sale: sale({ status: "active" }),
      lots: [lot({ status: "active" })],
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("rejects when lots have bids", () => {
    const result = validateSaleSoftDelete({
      sale: sale({ status: "scheduled" }),
      lots: [lot({ status: "scheduled" })],
      guards: { bidCount: 1, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("rejects when lots have payments", () => {
    const result = validateSaleSoftDelete({
      sale: sale({ status: "draft" }),
      lots: [lot()],
      guards: { bidCount: 0, paymentCount: 1, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("rejects when approved registrations exist", () => {
    const result = validateSaleSoftDelete({
      sale: sale({ status: "scheduled" }),
      lots: [lot({ status: "scheduled" })],
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 2 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("allows draft sale when some lots are already cancelled", () => {
    const result = validateSaleSoftDelete({
      sale: sale({ status: "draft" }),
      lots: [lot(), lot({ id: "l2", status: "cancelled" })],
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isOk()).toBe(true);
  });

  it("rejects when a lot is active", () => {
    const result = validateSaleSoftDelete({
      sale: sale({ status: "scheduled" }),
      lots: [lot({ status: "active" })],
      guards: { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 },
    });
    expect(result.isErr()).toBe(true);
  });

  it("lists all blockers for UI eligibility", () => {
    const blockers = listSaleSoftDeleteBlockers({
      sale: sale({ status: "scheduled" }),
      lots: [lot({ status: "scheduled" })],
      guards: { bidCount: 1, paymentCount: 1, approvedRegistrationCount: 1 },
    });
    expect(blockers).toEqual([
      "Lots in this sale have bids",
      "Lots in this sale have payments",
      "This sale has approved bidder registrations",
    ]);
  });
});
