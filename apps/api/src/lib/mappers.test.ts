import type { bid, itemSubmission, lot, payment, sale } from "@auction/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  mapBidRow,
  mapItemSubmissionRow,
  mapLotRow,
  mapPaymentRow,
  mapSaleRow,
} from "./mappers.js";

const now = new Date();

function lotRow(
  overrides: Partial<InferSelectModel<typeof lot>> = {},
): InferSelectModel<typeof lot> {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    saleId: null,
    lotNumber: null,
    sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
    artistId: null,
    artistReviewRequired: false,
    title: "Lot",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    auctionType: "english",
    startingPrice: "100.00",
    reservePrice: null,
    buyNowPrice: null,
    currentPrice: "100.00",
    buyerPremiumRate: "0.25",
    minBidIncrement: "1.00",
    dutchDecrementAmount: null,
    dutchDecrementIntervalMs: 60_000,
    dutchLastDecrementAt: null,
    startTime: now,
    endTime: now,
    status: "active",
    voidedReason: null,
    archivedSeller: false,
    winnerId: null,
    buyerLegalEntityId: null,
    createdAt: now,
    updatedAt: now,
    marketingDetails: {},
    ...overrides,
  };
}

function bidRow(
  overrides: Partial<InferSelectModel<typeof bid>> = {},
): InferSelectModel<typeof bid> {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    lotId: "00000000-0000-4000-8000-000000000001",
    bidderId: "buyer-1",
    buyerLegalEntityId: "00000000-0000-4000-8000-000000000011",
    amount: "110.00",
    isWinning: true,
    isAutoBid: false,
    maxAutoBidAmount: null,
    placedVia: null,
    telephoneBookingId: null,
    createdAt: now,
    ...overrides,
  };
}

function itemSubmissionRow(
  overrides: Partial<InferSelectModel<typeof itemSubmission>> = {},
): InferSelectModel<typeof itemSubmission> {
  return {
    id: "00000000-0000-4000-8000-000000000003",
    legalEntityId: "00000000-0000-4000-8000-000000000010",
    title: "Submission",
    description: null,
    medium: null,
    dimensions: null,
    images: [],
    yearOfWork: null,
    isSigned: false,
    signatureNote: null,
    edition: null,
    conditionSelfReport: null,
    provenance: [],
    exhibitions: [],
    askingPrice: null,
    reservePrice: null,
    submitterNotes: null,
    status: "draft",
    reviewedBy: null,
    reviewedAt: null,
    reviewNotes: null,
    rejectionReason: null,
    convertedLotId: null,
    assignedToUserId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function saleRow(
  overrides: Partial<InferSelectModel<typeof sale>> = {},
): InferSelectModel<typeof sale> {
  return {
    id: "00000000-0000-4000-8000-000000000004",
    title: "Sale",
    description: null,
    coverImages: [],
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
    startTime: now,
    endTime: now,
    previewStartTime: null,
    buyerPremiumRate: "0.25",
    terms: null,
    createdByLegalEntityId: "00000000-0000-4000-8000-000000000012",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function paymentRow(
  overrides: Partial<InferSelectModel<typeof payment>> = {},
): InferSelectModel<typeof payment> {
  return {
    id: "00000000-0000-4000-8000-000000000005",
    lotId: "00000000-0000-4000-8000-000000000001",
    buyerId: "buyer-1",
    buyerLegalEntityId: "00000000-0000-4000-8000-000000000011",
    sellerLegalEntityId: "00000000-0000-4000-8000-000000000010",
    amount: "125.00",
    platformFee: "6.25",
    stripePaymentIntentId: null,
    stripeChargeId: null,
    stripeRefundId: null,
    status: "pending",
    createdAt: now,
    ...overrides,
  };
}

describe("legal entity mapper read flip", () => {
  it("reads legal entity ids from new columns", () => {
    expect(mapLotRow(lotRow()).sellerLegalEntityId).toBe(lotRow().sellerLegalEntityId);
    expect(mapBidRow(bidRow()).buyerLegalEntityId).toBe(bidRow().buyerLegalEntityId);
    expect(mapItemSubmissionRow(itemSubmissionRow()).legalEntityId).toBe(
      itemSubmissionRow().legalEntityId,
    );
    expect(mapSaleRow(saleRow()).createdByLegalEntityId).toBe(saleRow().createdByLegalEntityId);
    const mappedPayment = mapPaymentRow(paymentRow());
    expect(mappedPayment.buyerLegalEntityId).toBe(paymentRow().buyerLegalEntityId);
    expect(mappedPayment.sellerLegalEntityId).toBe(paymentRow().sellerLegalEntityId);
  });

  it("throws instead of falling back to legacy user ids when backfill data is missing", () => {
    expect(() => mapLotRow(lotRow({ sellerLegalEntityId: null as unknown as string }))).toThrow(
      "missing_backfilled_legal_entity_id:lot:",
    );
    expect(() => mapBidRow(bidRow({ buyerLegalEntityId: null as unknown as string }))).toThrow(
      "missing_backfilled_legal_entity_id:bid:",
    );
    expect(() =>
      mapItemSubmissionRow(itemSubmissionRow({ legalEntityId: null as unknown as string })),
    ).toThrow("missing_backfilled_legal_entity_id:item_submission:");
    expect(() =>
      mapSaleRow(saleRow({ createdByLegalEntityId: null as unknown as string })),
    ).toThrow("missing_backfilled_legal_entity_id:sale:");
    expect(() =>
      mapPaymentRow(paymentRow({ buyerLegalEntityId: null as unknown as string })),
    ).toThrow("missing_backfilled_legal_entity_id:payment:");
    expect(() =>
      mapPaymentRow(paymentRow({ sellerLegalEntityId: null as unknown as string })),
    ).toThrow("missing_backfilled_legal_entity_id:payment:");
  });
});
