import type { lot, payment } from "@auction/db/schema";
import { mapBidRow, mapItemSubmissionRow, mapLotRow, mapSaleRow } from "@auction/persistence";
import type { Lot, LotSummary, Payment, PaymentStatus, PublicLotView } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

export { mapBidRow, mapItemSubmissionRow, mapLotRow, mapSaleRow };

type PaymentRow = InferSelectModel<typeof payment>;

type LotRow = InferSelectModel<typeof lot>;

function requireBackfilledLegalEntityId(value: string | null, context: string): string {
  if (!value) {
    throw new Error(`missing_backfilled_legal_entity_id:${context}`);
  }
  return value;
}

function summaryMarketingDetails(lot: Lot | PublicLotView): Lot["marketingDetails"] {
  const estimate = lot.marketingDetails?.estimate;
  return estimate ? { estimate } : {};
}

export function mapLotToSummary(lot: Lot | PublicLotView): LotSummary {
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
    ...(lot.status === "ended" ? { hasWinner: lot.winnerId != null } : {}),
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
