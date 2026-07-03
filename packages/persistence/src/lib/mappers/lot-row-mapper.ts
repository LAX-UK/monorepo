import type { lot } from "@auction/db/schema";
import type {
  Lot,
  LotMarketingDetails,
  LotStatus,
  LotSummary,
  PublicLotView,
} from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

type LotRow = InferSelectModel<typeof lot>;

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
    auctionType: row.auctionType as Lot["auctionType"],
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

export type { LotRow };
