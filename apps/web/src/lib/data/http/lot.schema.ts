import { isIndexableObject, toObjectRecord } from "@/lib/data/http/object-guards";
import { zCoerceDate, zStringArrayFromUnknown } from "@/lib/data/http/schema-coerce";
import type { Lot, LotMarketingDetails, PublicLotView } from "@auction/types";
import { z } from "zod";

function parseMarketingDetails(raw: unknown): LotMarketingDetails {
  if (!isIndexableObject(raw)) return {};
  return raw as LotMarketingDetails;
}

function parseCheckoutPricing(raw: unknown): Lot["checkoutPricing"] | undefined {
  if (!isIndexableObject(raw)) return undefined;
  const hammerMajor = String(raw.hammerMajor ?? "").trim();
  const premiumMajor = String(raw.premiumMajor ?? "").trim();
  const totalMajor = String(raw.totalMajor ?? "").trim();
  const policyId = String(raw.policyId ?? "").trim();
  if (!hammerMajor || !policyId) return undefined;
  const rawKind = raw.kind;
  const kind: "flat" | "tiered" =
    rawKind === "tiered" || rawKind === "flat"
      ? rawKind
      : policyId.startsWith("tiered:")
        ? "tiered"
        : "flat";
  return { hammerMajor, premiumMajor, totalMajor, policyId, kind };
}

function nullableString(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

const lotRowSchema = z.preprocess(toObjectRecord, z.record(z.unknown())).transform((row): Lot => {
  const checkoutPricing = parseCheckoutPricing(row.checkoutPricing);

  return {
    id: String(row.id),
    saleId: nullableString(row.saleId),
    lotNumber:
      row.lotNumber == null || row.lotNumber === ""
        ? null
        : typeof row.lotNumber === "number"
          ? row.lotNumber
          : Number.parseInt(String(row.lotNumber), 10),
    ...(row.sellerId != null && row.sellerId !== "" ? { sellerId: String(row.sellerId) } : {}),
    ...(row.sellerLegalEntityId != null && row.sellerLegalEntityId !== ""
      ? { sellerLegalEntityId: String(row.sellerLegalEntityId) }
      : {}),
    artistId: row.artistId == null ? null : String(row.artistId),
    artistReviewRequired: Boolean(row.artistReviewRequired),
    categoryIds: zStringArrayFromUnknown.parse(row.categoryIds),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    medium: nullableString(row.medium),
    dimensions: nullableString(row.dimensions),
    images: zStringArrayFromUnknown.parse(row.images),
    categoryId: String(row.categoryId ?? ""),
    auctionType: row.auctionType as Lot["auctionType"],
    startingPrice:
      row.startingPrice == null || row.startingPrice === "" ? "0.00" : String(row.startingPrice),
    reservePrice: row.reservePrice == null ? null : String(row.reservePrice),
    buyNowPrice: row.buyNowPrice == null ? null : String(row.buyNowPrice),
    currentPrice: String(row.currentPrice),
    buyerPremiumRate:
      row.buyerPremiumRate == null || row.buyerPremiumRate === ""
        ? "0.25"
        : String(row.buyerPremiumRate),
    ...(checkoutPricing !== undefined ? { checkoutPricing } : {}),
    minBidIncrement:
      row.minBidIncrement == null || row.minBidIncrement === ""
        ? "1.00"
        : String(row.minBidIncrement),
    dutchDecrementAmount: nullableString(row.dutchDecrementAmount),
    dutchDecrementIntervalMs:
      typeof row.dutchDecrementIntervalMs === "number" &&
      Number.isFinite(row.dutchDecrementIntervalMs)
        ? row.dutchDecrementIntervalMs
        : 60_000,
    dutchLastDecrementAt:
      row.dutchLastDecrementAt == null ? null : zCoerceDate.parse(row.dutchLastDecrementAt),
    startTime: zCoerceDate.parse(row.startTime),
    endTime: zCoerceDate.parse(row.endTime),
    status: row.status as Lot["status"],
    winnerId: row.winnerId == null ? null : String(row.winnerId),
    ...(typeof row.hasWinner === "boolean" ? { hasWinner: row.hasWinner } : {}),
    createdAt: zCoerceDate.parse(row.createdAt),
    updatedAt: zCoerceDate.parse(row.updatedAt),
    marketingDetails: parseMarketingDetails(row.marketingDetails),
  };
});

export const lotSchema = lotRowSchema as z.ZodType<Lot>;

export function parseLotSchema(raw: unknown): Lot {
  return lotSchema.parse(raw);
}

const publicLotViewRowSchema = z
  .preprocess(toObjectRecord, z.record(z.unknown()))
  .transform((row): Lot | PublicLotView => {
    const lot = lotRowSchema.parse(row);
    if (
      typeof row.hasReserve === "boolean" &&
      (row.reservePrice === undefined || row.reservePrice === null)
    ) {
      const { reservePrice: _reserve, ...rest } = lot;
      return {
        ...rest,
        hasReserve: row.hasReserve,
        reserveMet: row.reserveMet === true || row.reserveMet === false ? row.reserveMet : null,
      };
    }
    return lot;
  });

export const publicLotViewSchema = publicLotViewRowSchema as z.ZodType<Lot | PublicLotView>;

export function parsePublicLotViewSchema(raw: unknown): Lot | PublicLotView {
  return publicLotViewSchema.parse(raw);
}

type _LotInfer = z.infer<typeof lotSchema>;
const _lotTypeGuard = null as unknown as _LotInfer satisfies Lot;
void _lotTypeGuard;
