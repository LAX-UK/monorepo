import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";
import { humanizeSetupError } from "./humanize-setup-error";
import { emptySaleSetupLotRow, safeParseSaleSetupLotRowForApi } from "./lot-row-schema";
import { buildSaleSetupReadiness } from "./readiness";
import { resolveFirstIncompleteStep, saleSetupStepIndex } from "./steps";

const saleId = "10000000-0000-4000-8000-000000000001";
const sellerId = "20000000-0000-4000-8000-000000000002";
const categoryId = "30000000-0000-4000-8000-000000000003";

function draftSale(overrides: Partial<Sale> = {}): Sale {
  const start = new Date(Date.now() + 86_400_000);
  const end = new Date(start.getTime() + 86_400_000);
  return {
    id: saleId,
    title: "Test sale",
    description: null,
    status: "draft",
    deliveryMode: "online",
    startTime: start,
    endTime: end,
    previewStartTime: null,
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
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: null,
    terms: null,
    coverImages: [],
    categoryIds: [],
    createdByLegalEntityId: sellerId,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as Sale;
}

function draftLot(overrides: Partial<Lot> = {}): Lot {
  const start = new Date(Date.now() + 86_400_000);
  const end = new Date(start.getTime() + 3_600_000);
  return {
    id: "40000000-0000-4000-8000-000000000004",
    title: "Lot one",
    description: "",
    saleId,
    sellerLegalEntityId: sellerId,
    images: [],
    status: "draft",
    startTime: start,
    endTime: end,
    artistReviewRequired: false,
    ...overrides,
  } as Lot;
}

describe("saleSetupStepIndex", () => {
  it("maps step ids to indices", () => {
    expect(saleSetupStepIndex("lots")).toBe(3);
    expect(saleSetupStepIndex("unknown")).toBe(0);
  });
});

describe("resolveFirstIncompleteStep", () => {
  it("returns identity when no sale", () => {
    expect(resolveFirstIncompleteStep({ sale: null, lots: [] })).toBe("identity");
  });

  it("returns lots when sale exists but no lots", () => {
    expect(resolveFirstIncompleteStep({ sale: draftSale(), lots: [] })).toBe("lots");
  });

  it("returns catalog-prep when lot missing images", () => {
    expect(
      resolveFirstIncompleteStep({ sale: draftSale(), lots: [draftLot({ images: [] })] }),
    ).toBe("catalog-prep");
  });
});

describe("safeParseSaleSetupLotRowForApi", () => {
  it("maps sellerLegalEntityId to sellerId for API", () => {
    const row = {
      ...emptySaleSetupLotRow("row-1"),
      title: "Vase",
      sellerLegalEntityId: sellerId,
      categoryIds: [categoryId],
      startingPrice: "100.00",
      startTime: "2030-01-01T10:00",
      endTime: "2030-01-01T11:00",
    };
    const ctx = {
      saleStartTime: new Date("2030-01-01T09:00"),
      saleEndTime: new Date("2030-01-01T18:00"),
      deliveryMode: "online" as const,
      englishOnlyAuctionsLocked: false,
    };
    const parsed = safeParseSaleSetupLotRowForApi(row, ctx);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.sellerId).toBe(sellerId);
    }
  });
});

describe("buildSaleSetupReadiness", () => {
  it("includes lot-level blockers with plain labels", () => {
    const result = buildSaleSetupReadiness({
      saleId,
      sale: draftSale(),
      lots: [draftLot({ title: "Blue vase", images: [] })],
      setupStepHref: (step) => `/setup?step=${step}`,
    });
    const imageItem = result.items.find((i) => i.id.includes("images"));
    expect(imageItem?.ok).toBe(false);
    expect(imageItem?.label).toContain("Blue vase");
  });
});

describe("humanizeSetupError", () => {
  it("translates known backend messages", () => {
    expect(humanizeSetupError({ message: "endTime must be after startTime" })).toBe(
      "Closing time must be after opening time.",
    );
  });

  it("handles connect_required code", () => {
    expect(humanizeSetupError({ message: "x", errorCode: "connect_required" })).toContain(
      "payout setup",
    );
  });
});
