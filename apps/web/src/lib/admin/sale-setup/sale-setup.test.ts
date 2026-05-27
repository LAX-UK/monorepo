import type { Lot, Sale } from "@auction/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { humanizeSetupError } from "./humanize-setup-error";
import { emptySaleSetupLotRow, safeParseSaleSetupLotRowForApi } from "./lot-row-schema";
import {
  buildSaleSetupReadiness,
  countLotsCatalogReady,
  isSaleSetupPublishReady,
  resolveFirstBlockingSetupStep,
} from "./readiness";
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
    expect(
      resolveFirstBlockingSetupStep({ sale: draftSale(), lots: [draftLot({ images: [] })] }),
    ).toBe("catalog-prep");
  });

  it("returns schedule when opening time is in the past", () => {
    const pastStart = new Date(Date.now() - 3_600_000);
    const futureEnd = new Date(Date.now() + 86_400_000);
    const sale = draftSale({ startTime: pastStart, endTime: futureEnd });
    const lot = draftLot({
      images: ["img-key"],
      description: "Catalogue text",
    });
    expect(resolveFirstIncompleteStep({ sale, lots: [lot] })).toBe("schedule");
  });

  it("returns review when sale and lots are publish-ready", () => {
    const lot = draftLot({
      images: ["img-key"],
      description: "Catalogue text",
    });
    expect(resolveFirstIncompleteStep({ sale: draftSale(), lots: [lot] })).toBe("review");
    expect(
      isSaleSetupPublishReady({
        saleId,
        sale: draftSale(),
        lots: [lot],
      }),
    ).toBe(true);
  });

  it("returns catalog-prep when connect is required for a lot", () => {
    const lot = draftLot({
      images: ["img-key"],
      description: "Catalogue text",
    });
    expect(
      resolveFirstIncompleteStep({
        sale: draftSale(),
        lots: [lot],
        connectRequiredByLotId: { [lot.id]: true },
      }),
    ).toBe("catalog-prep");
  });
});

describe("buildSaleSetupReadiness", () => {
  it("uses connect readiness label when connect is required", () => {
    const lot = draftLot({
      images: ["img-key"],
      description: "Catalogue text",
      sellerLegalEntityId: sellerId,
    });
    const result = buildSaleSetupReadiness({
      saleId,
      sale: draftSale(),
      lots: [lot],
      connectRequiredByLotId: { [lot.id]: true },
    });
    const sellerItem = result.items.find((i) => i.id === `lot:${lot.id}:seller`);
    expect(sellerItem?.label).toBe("Seller must finish payout setup");
  });
});

describe("countLotsCatalogReady", () => {
  it("excludes lots blocked by Connect from ready count", () => {
    const lot = draftLot({
      images: ["img-key"],
      description: "Catalogue text",
    });
    expect(countLotsCatalogReady([lot])).toEqual({ ready: 1, total: 1 });
    expect(countLotsCatalogReady([lot], { [lot.id]: true })).toEqual({ ready: 0, total: 1 });
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

  it("rejects lot start before sale start", () => {
    const row = {
      ...emptySaleSetupLotRow("row-1"),
      title: "Vase",
      sellerLegalEntityId: sellerId,
      categoryIds: [categoryId],
      startingPrice: "100.00",
      startTime: "2030-01-01T08:00",
      endTime: "2030-01-01T11:00",
    };
    const ctx = {
      saleStartTime: new Date("2030-01-01T09:00"),
      saleEndTime: new Date("2030-01-01T18:00"),
      deliveryMode: "online" as const,
      englishOnlyAuctionsLocked: false,
    };
    const parsed = safeParseSaleSetupLotRowForApi(row, ctx);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["startTime"]);
    }
  });

  it("rejects lot end after sale end", () => {
    const row = {
      ...emptySaleSetupLotRow("row-1"),
      title: "Vase",
      sellerLegalEntityId: sellerId,
      categoryIds: [categoryId],
      startingPrice: "100.00",
      startTime: "2030-01-01T10:00",
      endTime: "2030-01-01T19:00",
    };
    const ctx = {
      saleStartTime: new Date("2030-01-01T09:00"),
      saleEndTime: new Date("2030-01-01T18:00"),
      deliveryMode: "online" as const,
      englishOnlyAuctionsLocked: false,
    };
    const parsed = safeParseSaleSetupLotRowForApi(row, ctx);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.path).toEqual(["endTime"]);
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
    expect(imageItem?.href).toBe("/setup?step=catalog-prep");
  });

  it("links schedule blockers to the schedule step", () => {
    const pastStart = new Date(Date.now() - 3_600_000);
    const futureEnd = new Date(Date.now() + 86_400_000);
    const result = buildSaleSetupReadiness({
      saleId,
      sale: draftSale({ startTime: pastStart, endTime: futureEnd }),
      lots: [draftLot({ images: ["img"], description: "desc" })],
      setupStepHref: (step) => `/setup?step=${step}`,
    });
    const futureItem = result.items.find((i) => i.id === "sale_start_future");
    expect(futureItem?.href).toBe("/setup?step=schedule");
  });

  it("adds sale_window readiness when lot opens before sale start", () => {
    const saleStart = new Date(Date.now() + 86_400_000);
    const saleEnd = new Date(saleStart.getTime() + 86_400_000);
    const lot = draftLot({
      title: "Blue vase",
      startTime: new Date(saleStart.getTime() - 3_600_000),
      endTime: new Date(saleStart.getTime() + 3_600_000),
      images: ["img"],
      description: "desc",
    });
    const result = buildSaleSetupReadiness({
      saleId,
      sale: draftSale({ startTime: saleStart, endTime: saleEnd }),
      lots: [lot],
      setupStepHref: (step) => `/setup?step=${step}`,
    });
    const windowItem = result.items.find((i) => i.id === `lot:${lot.id}:sale_window`);
    expect(windowItem?.ok).toBe(false);
    expect(windowItem?.label).toContain("Blue vase");
    expect(windowItem?.href).toBe("/setup?step=lots");
    expect(
      resolveFirstBlockingSetupStep({
        sale: draftSale({ startTime: saleStart, endTime: saleEnd }),
        lots: [lot],
      }),
    ).toBe("lots");
  });

  it("omits venue check for online sales", () => {
    const result = buildSaleSetupReadiness({
      saleId,
      sale: draftSale({ deliveryMode: "online" }),
      lots: [draftLot({ images: ["img"], description: "desc" })],
    });
    expect(result.items.some((i) => i.id === "venue")).toBe(false);
  });

  it("includes connect blockers when connectRequiredByLotId is set", () => {
    const lot = draftLot({ images: ["img"], description: "desc" });
    const result = buildSaleSetupReadiness({
      saleId,
      sale: draftSale(),
      lots: [lot],
      connectRequiredByLotId: { [lot.id]: true },
    });
    const connectItem = result.items.find((i) => i.id.includes(":seller"));
    expect(connectItem?.ok).toBe(false);
    expect(connectItem?.label).toContain("payout setup");
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
