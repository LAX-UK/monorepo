import type { bid, itemSubmission, lot, payment, sale } from "@auction/db/schema";
import type {
  Bid,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
  LotAuctionType,
  LotMarketingDetails,
  LotStatus,
  LotSummary,
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
    autoBidEnabled: row.autoBidEnabled ?? true,
    autoBidStepMin: row.autoBidStepMin !== null ? String(row.autoBidStepMin) : null,
    autoBidStepMax: row.autoBidStepMax !== null ? String(row.autoBidStepMax) : null,
    autoBidStepPresets: row.autoBidStepPresets ?? null,
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
    deletedAt: row.deletedAt ?? null,
    deletedByUserId: row.deletedByUserId ?? null,
  } as Lot;
}

function summaryMarketingDetails(lot: Lot): Lot["marketingDetails"] {
  const estimate = lot.marketingDetails?.estimate;
  return estimate ? { estimate } : {};
}

export function mapLotToSummary(lot: Lot): LotSummary {
  return {
    id: lot.id,
    saleId: lot.saleId,
    lotNumber: lot.lotNumber,
    title: lot.title,
    status: lot.status,
    currentPrice: lot.currentPrice,
    startingPrice: lot.startingPrice,
    auctionType: lot.auctionType,
    medium: lot.medium,
    startTime: lot.startTime,
    endTime: lot.endTime,
    images: lot.images,
    categoryIds: lot.categoryIds ?? (lot.categoryId ? [lot.categoryId] : []),
    marketingDetails: summaryMarketingDetails(lot),
  };
}

export type LotStaffListExtras = {
  lifecycleSummary?: {
    lastEventType: string;
    lastEventAt: string;
    returnCount: number;
  };
  deleteEligibility?: {
    canDelete: boolean;
    confirmationPhrase: string | null;
    blockers: string[];
  };
  connectRequired?: boolean;
};

/** Staff catalogue list row — table fields without checkout pricing or heavy catalogue payload. */
export function mapLotToStaffListRow(lot: Lot & LotStaffListExtras) {
  const {
    checkoutPricing: _checkoutPricing,
    imageAssets: _imageAssets,
    description: _description,
    marketingDetails: _marketingDetails,
    ...base
  } = lot as Lot &
    LotStaffListExtras & {
      checkoutPricing?: unknown;
      imageAssets?: unknown;
    };
  return {
    id: base.id,
    saleId: base.saleId,
    lotNumber: base.lotNumber,
    title: base.title,
    status: base.status,
    auctionType: base.auctionType,
    currentPrice: base.currentPrice,
    endTime: base.endTime,
    startTime: base.startTime,
    images: base.images,
    categoryIds: base.categoryIds ?? (base.categoryId ? [base.categoryId] : []),
    categoryId: base.categoryId,
    sellerLegalEntityId: base.sellerLegalEntityId,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    ...(lot.lifecycleSummary ? { lifecycleSummary: lot.lifecycleSummary } : {}),
    ...(lot.deleteEligibility ? { deleteEligibility: lot.deleteEligibility } : {}),
    ...(lot.connectRequired !== undefined ? { connectRequired: lot.connectRequired } : {}),
  };
}

export function mapLotSummaryRow(row: LotRow, categoryIds: string[] = []): LotSummary {
  return mapLotToSummary(mapLotRow(row, categoryIds));
}

export function mapBidRow(row: BidRow): Bid {
  return {
    id: row.id,
    lotId: row.lotId,
    bidderId: row.bidderId,
    placedByUserId: row.bidderId,
    buyerLegalEntityId: requireBackfilledLegalEntityId(row.buyerLegalEntityId, `bid:${row.id}`),
    amount: String(row.amount),
    isWinning: row.isWinning,
    isAutoBid: row.isAutoBid,
    maxAutoBidAmount: row.maxAutoBidAmount !== null ? String(row.maxAutoBidAmount) : null,
    autoBidStepAmount: row.autoBidStepAmount !== null ? String(row.autoBidStepAmount) : null,
    placedVia: row.placedVia ?? null,
    telephoneBookingId: row.telephoneBookingId ?? null,
    clerkUserId: row.clerkUserId ?? null,
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
    assignedToUserId: row.assignedToUserId ?? null,
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
    allowOnlineBidsBeforeGoLive: row.allowOnlineBidsBeforeGoLive ?? false,
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
    venueId: row.venueId ?? null,
    status: row.status as SaleStatus,
    startTime: row.startTime,
    endTime: row.endTime,
    previewStartTime: row.previewStartTime ?? null,
    buyerPremiumRate: String(row.buyerPremiumRate),
    buyerPremiumTiers: row.buyerPremiumTiers ?? null,
    terms: row.terms ?? null,
    createdByLegalEntityId: requireBackfilledLegalEntityId(
      row.createdByLegalEntityId,
      `sale:${row.id}`,
    ),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
    deletedByUserId: row.deletedByUserId ?? null,
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
    stripeRefundId: row.stripeRefundId ?? null,
    status: row.status as PaymentStatus,
    createdAt: row.createdAt,
  };
}
