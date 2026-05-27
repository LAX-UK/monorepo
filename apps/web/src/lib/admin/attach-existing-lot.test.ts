import type { Lot } from "@auction/types";
import { instantFromDatetimeFormString } from "@auction/ui/lib/datetime";
import { describe, expect, it } from "vitest";
import {
  attachReviewScheduleChanged,
  attachReviewScheduleViolation,
  inventoryLotToAttachReviewRow,
  validateAttachReviewSchedule,
} from "./attach-existing-lot";

const saleStart = instantFromDatetimeFormString("2030-06-01T10:00");
const saleEnd = instantFromDatetimeFormString("2030-06-01T18:00");

function draftLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "40000000-0000-4000-8000-000000000004",
    title: "Blue vase",
    description: null,
    saleId: null,
    lotNumber: null,
    sellerLegalEntityId: "20000000-0000-4000-8000-000000000002",
    images: [],
    status: "draft",
    startTime: new Date("2030-01-01T10:00:00"),
    endTime: new Date("2030-01-01T11:00:00"),
    artistReviewRequired: false,
    auctionType: "english",
    startingPrice: "100.00",
    categoryIds: ["30000000-0000-4000-8000-000000000003"],
    artistId: null,
    medium: null,
    dimensions: null,
    ...overrides,
  } as Lot;
}

describe("inventoryLotToAttachReviewRow", () => {
  it("maps lot fields for attach review", () => {
    const lot = draftLot();
    const row = inventoryLotToAttachReviewRow(lot, "row-1");
    expect(row.source).toBe("existing");
    expect(row.lotId).toBeUndefined();
    expect(row.title).toBe("Blue vase");
    expect(row.sellerLegalEntityId).toBe(lot.sellerLegalEntityId);
    expect(row.categoryIds).toEqual(lot.categoryIds);
    expect(row.startingPrice).toBe("100.00");
  });
});

describe("attachReviewScheduleChanged", () => {
  it("detects when schedule differs from the loaded lot", () => {
    const lot = draftLot();
    const row = inventoryLotToAttachReviewRow(lot, "row-1");
    expect(attachReviewScheduleChanged(lot, row)).toBe(false);
    expect(
      attachReviewScheduleChanged(lot, {
        ...row,
        startTime: "2030-06-01T10:30",
        endTime: "2030-06-01T11:30",
      }),
    ).toBe(true);
  });
});

describe("attachReviewScheduleViolation", () => {
  it("returns violation when lot opens before sale start", () => {
    const lot = draftLot();
    const row = inventoryLotToAttachReviewRow(lot, "row-1");
    expect(
      attachReviewScheduleViolation(row, {
        saleStartTime: saleStart,
        saleEndTime: saleEnd,
        deliveryMode: "online",
        englishOnlyAuctionsLocked: false,
      }),
    ).toContain("Lot start must not be before");
  });

  it("returns null for onsite sales", () => {
    const lot = draftLot();
    const row = inventoryLotToAttachReviewRow(lot, "row-1");
    expect(
      attachReviewScheduleViolation(row, {
        saleStartTime: saleStart,
        saleEndTime: saleEnd,
        deliveryMode: "onsite",
        englishOnlyAuctionsLocked: false,
      }),
    ).toBeNull();
  });
});

describe("validateAttachReviewSchedule", () => {
  it("blocks attach when schedule is outside the sale window", () => {
    const lot = draftLot();
    const row = inventoryLotToAttachReviewRow(lot, "row-1");
    const result = validateAttachReviewSchedule(row, {
      saleStartTime: saleStart,
      saleEndTime: saleEnd,
      deliveryMode: "online",
      englishOnlyAuctionsLocked: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.startTime ?? result.fieldErrors.endTime).toBeTruthy();
  });

  it("passes when schedule fits the sale window", () => {
    const lot = draftLot({
      startTime: instantFromDatetimeFormString("2030-06-01T10:30"),
      endTime: instantFromDatetimeFormString("2030-06-01T11:30"),
    });
    const row = inventoryLotToAttachReviewRow(lot, "row-1");
    const result = validateAttachReviewSchedule(row, {
      saleStartTime: saleStart,
      saleEndTime: saleEnd,
      deliveryMode: "online",
      englishOnlyAuctionsLocked: false,
    });
    expect(result.ok).toBe(true);
  });
});
