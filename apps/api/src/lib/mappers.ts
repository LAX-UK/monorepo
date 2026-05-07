import type { bid, itemSubmission, lot, payment, sale } from "@auction/db/schema";
import type {
  Bid,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
  LotAuctionType,
  LotMarketingDetails,
  LotStatus,
  Payment,
  PaymentStatus,
  Sale,
  SaleDeliveryMode,
  SaleStatus,
} from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

type LotRow = InferSelectModel<typeof lot>;
type BidRow = InferSelectModel<typeof bid>;
type SaleRow = InferSelectModel<typeof sale>;
type ItemSubmissionRow = InferSelectModel<typeof itemSubmission>;
type PaymentRow = InferSelectModel<typeof payment>;

function parseMarketingDetails(raw: unknown): LotMarketingDetails {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as LotMarketingDetails;
}

function requireBackfilledLegalEntityId(value: string | null, context: string): string {
  if (!value) {
    throw new Error(`missing_backfilled_legal_entity_id:${context}`);
  }
  return value;
}

export function mapLotRow(row: LotRow, categoryIds: string[] = []): Lot {
  const primaryCategoryId = categoryIds[0] ?? "";
  return {
    id: row.id,
    saleId: row.saleId ?? null,
    lotNumber: row.lotNumber ?? null,
    sellerLegalEntityId: requireBackfilledLegalEntityId(row.sellerLegalEntityId, `lot:${row.id}`),
    artistId: row.artistId ?? null,
    artistReviewRequired: row.artistReviewRequired ?? false,
    title: row.title,
    description: row.description,
    medium: row.medium ?? null,
    dimensions: row.dimensions ?? null,
    images: row.images ?? [],
    categoryIds,
    categoryId: primaryCategoryId,
    auctionType: row.auctionType as LotAuctionType,
    startingPrice: String(row.startingPrice),
    reservePrice: row.reservePrice !== null ? String(row.reservePrice) : null,
    buyNowPrice: row.buyNowPrice !== null ? String(row.buyNowPrice) : null,
    currentPrice: String(row.currentPrice),
    buyerPremiumRate: String(row.buyerPremiumRate),
    minBidIncrement: String(row.minBidIncrement),
    dutchDecrementAmount:
      row.dutchDecrementAmount !== null ? String(row.dutchDecrementAmount) : null,
    dutchDecrementIntervalMs: row.dutchDecrementIntervalMs,
    dutchLastDecrementAt: row.dutchLastDecrementAt ?? null,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status as LotStatus,
    voidedReason: row.voidedReason ?? null,
    archivedSeller: row.archivedSeller ?? false,
    winnerId: row.winnerId,
    buyerLegalEntityId: row.buyerLegalEntityId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    marketingDetails: parseMarketingDetails(row.marketingDetails),
  } as Lot;
}

export function mapBidRow(row: BidRow): Bid {
  return {
    id: row.id,
    lotId: row.lotId,
    placedByUserId: row.bidderId,
    buyerLegalEntityId: requireBackfilledLegalEntityId(row.buyerLegalEntityId, `bid:${row.id}`),
    amount: String(row.amount),
    isWinning: row.isWinning,
    isAutoBid: row.isAutoBid,
    maxAutoBidAmount: row.maxAutoBidAmount !== null ? String(row.maxAutoBidAmount) : null,
    createdAt: row.createdAt,
  };
}

export function mapItemSubmissionRow(
  row: ItemSubmissionRow,
  categoryIds: string[] = [],
): ItemSubmission {
  const primaryCategoryId = categoryIds[0] ?? "";
  return {
    id: row.id,
    legalEntityId: requireBackfilledLegalEntityId(row.legalEntityId, `item_submission:${row.id}`),
    title: row.title,
    description: row.description,
    medium: row.medium,
    dimensions: row.dimensions,
    images: row.images ?? [],
    yearOfWork: row.yearOfWork,
    isSigned: row.isSigned,
    signatureNote: row.signatureNote,
    edition: row.edition,
    conditionSelfReport: row.conditionSelfReport,
    provenance: row.provenance ?? [],
    exhibitions: row.exhibitions ?? [],
    askingPrice: row.askingPrice !== null ? String(row.askingPrice) : null,
    reservePrice: row.reservePrice !== null ? String(row.reservePrice) : null,
    categoryIds,
    categoryId: primaryCategoryId,
    submitterNotes: row.submitterNotes,
    status: row.status as ItemSubmissionStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ?? null,
    reviewNotes: row.reviewNotes,
    rejectionReason: row.rejectionReason,
    convertedLotId: row.convertedLotId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapSaleRow(row: SaleRow, categoryIds: string[] = []): Sale {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverImages: row.coverImages ?? [],
    categoryIds,
    categoryId: categoryIds[0] ?? null,
    deliveryMode: (row.deliveryMode ?? "onsite") as SaleDeliveryMode,
    streamUrl: row.streamUrl ?? null,
    locationName: row.locationName ?? null,
    locationAddress: row.locationAddress ?? null,
    locationMapUrl: row.locationMapUrl ?? null,
    locationAddressLine1: row.locationAddressLine1 ?? null,
    locationAddressLine2: row.locationAddressLine2 ?? null,
    locationCity: row.locationCity ?? null,
    locationCounty: row.locationCounty ?? null,
    locationPostcode: row.locationPostcode ?? null,
    locationCountry: row.locationCountry ?? null,
    status: row.status as SaleStatus,
    startTime: row.startTime,
    endTime: row.endTime,
    previewStartTime: row.previewStartTime ?? null,
    buyerPremiumRate: String(row.buyerPremiumRate),
    terms: row.terms ?? null,
    createdByLegalEntityId: requireBackfilledLegalEntityId(
      row.createdByLegalEntityId,
      `sale:${row.id}`,
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapPaymentRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    lotId: row.lotId,
    buyerLegalEntityId: requireBackfilledLegalEntityId(
      row.buyerLegalEntityId,
      `payment:${row.id}:buyer`,
    ),
    sellerLegalEntityId: requireBackfilledLegalEntityId(
      row.sellerLegalEntityId,
      `payment:${row.id}:seller`,
    ),
    amount: String(row.amount),
    platformFee: String(row.platformFee),
    stripePaymentIntentId: row.stripePaymentIntentId ?? null,
    stripeChargeId: row.stripeChargeId ?? null,
    status: row.status as PaymentStatus,
    createdAt: row.createdAt,
  };
}
