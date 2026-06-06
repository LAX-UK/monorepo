import type {
  Bid,
  BuyerPremiumTier,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
  LotMarketingDetails,
  NotificationPreference,
  Sale,
  UserNotification,
} from "@auction/types";
import { itemSubmissionStatuses } from "@auction/types";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

/** Coerce serialized or unknown values to a Date (RSC props, JSON payloads). */
export function coerceToDate(value: unknown): Date {
  return toDate(value);
}

function parseSaleDeliveryMode(raw: unknown): Sale["deliveryMode"] {
  const v = typeof raw === "string" ? raw : "";
  if (v === "online" || v === "onsite") return v;
  if (v === "hybrid") return "online";
  return "onsite";
}

function parseBuyerPremiumTiers(raw: unknown): BuyerPremiumTier[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: BuyerPremiumTier[] = [];
  for (const entry of raw as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const threshold =
      typeof o.hammerThresholdMinor === "number"
        ? o.hammerThresholdMinor
        : Number.parseInt(String(o.hammerThresholdMinor ?? ""), 10);
    const rate = String(o.rate ?? "");
    if (!Number.isFinite(threshold) || threshold < 0) continue;
    if (!/^\d(\.\d{1,4})?$/.test(rate)) continue;
    out.push({ hammerThresholdMinor: threshold, rate });
  }
  return out.length > 0 ? out : null;
}

export function parseSale(raw: unknown): Sale {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    title: String(o.title),
    description: o.description == null ? null : String(o.description),
    coverImages: Array.isArray(o.coverImages) ? (o.coverImages as unknown[]).map(String) : [],
    categoryId: o.categoryId == null || o.categoryId === "" ? null : String(o.categoryId),
    deliveryMode: parseSaleDeliveryMode(o.deliveryMode),
    streamUrl: o.streamUrl == null || o.streamUrl === "" ? null : String(o.streamUrl),
    locationName: o.locationName == null || o.locationName === "" ? null : String(o.locationName),
    locationAddress:
      o.locationAddress == null || o.locationAddress === "" ? null : String(o.locationAddress),
    locationMapUrl:
      o.locationMapUrl == null || o.locationMapUrl === "" ? null : String(o.locationMapUrl),
    locationAddressLine1:
      o.locationAddressLine1 == null || o.locationAddressLine1 === ""
        ? null
        : String(o.locationAddressLine1),
    locationAddressLine2:
      o.locationAddressLine2 == null || o.locationAddressLine2 === ""
        ? null
        : String(o.locationAddressLine2),
    locationCity: o.locationCity == null || o.locationCity === "" ? null : String(o.locationCity),
    locationCounty:
      o.locationCounty == null || o.locationCounty === "" ? null : String(o.locationCounty),
    locationPostcode:
      o.locationPostcode == null || o.locationPostcode === "" ? null : String(o.locationPostcode),
    locationCountry:
      o.locationCountry == null || o.locationCountry === "" ? null : String(o.locationCountry),
    status: o.status as Sale["status"],
    startTime: toDate(o.startTime),
    endTime: toDate(o.endTime),
    previewStartTime:
      o.previewStartTime == null || o.previewStartTime === "" ? null : toDate(o.previewStartTime),
    buyerPremiumRate:
      o.buyerPremiumRate == null || o.buyerPremiumRate === "" ? "0.25" : String(o.buyerPremiumRate),
    buyerPremiumTiers: parseBuyerPremiumTiers(o.buyerPremiumTiers),
    terms: o.terms == null || o.terms === "" ? null : String(o.terms),
    createdBy: String(o.createdBy ?? ""),
    createdAt: toDate(o.createdAt),
    updatedAt: toDate(o.updatedAt),
  };
}

function parseMarketingDetails(raw: unknown): LotMarketingDetails {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as LotMarketingDetails;
}

function parseCheckoutPricing(raw: unknown): Lot["checkoutPricing"] | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const x = raw as Record<string, unknown>;
  const hammerMajor = String(x.hammerMajor ?? "").trim();
  const premiumMajor = String(x.premiumMajor ?? "").trim();
  const totalMajor = String(x.totalMajor ?? "").trim();
  const policyId = String(x.policyId ?? "").trim();
  if (!hammerMajor || !policyId) return undefined;
  const rawKind = x.kind;
  const kind: "flat" | "tiered" =
    rawKind === "tiered" || rawKind === "flat"
      ? rawKind
      : policyId.startsWith("tiered:")
        ? "tiered"
        : "flat";
  return { hammerMajor, premiumMajor, totalMajor, policyId, kind };
}

function nullableString(v: unknown): string | null {
  return v == null || v === "" ? null : String(v);
}

function parseStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as unknown[]).map(String) : [];
}

export function parseLot(raw: unknown): Lot {
  const o = raw as Record<string, unknown>;
  const checkoutPricing = parseCheckoutPricing(o.checkoutPricing);
  return {
    id: String(o.id),
    saleId: nullableString(o.saleId),
    lotNumber:
      o.lotNumber == null || o.lotNumber === ""
        ? null
        : typeof o.lotNumber === "number"
          ? o.lotNumber
          : Number.parseInt(String(o.lotNumber), 10),
    ...(o.sellerId != null && o.sellerId !== "" ? { sellerId: String(o.sellerId) } : {}),
    ...(o.sellerLegalEntityId != null && o.sellerLegalEntityId !== ""
      ? { sellerLegalEntityId: String(o.sellerLegalEntityId) }
      : {}),
    artistId: o.artistId == null ? null : String(o.artistId),
    artistReviewRequired: Boolean(o.artistReviewRequired),
    categoryIds: parseStringArray(o.categoryIds),
    title: String(o.title),
    description: o.description == null ? null : String(o.description),
    medium: o.medium == null || o.medium === "" ? null : String(o.medium),
    dimensions: o.dimensions == null || o.dimensions === "" ? null : String(o.dimensions),
    images: Array.isArray(o.images) ? (o.images as unknown[]).map(String) : [],
    categoryId: String(o.categoryId ?? ""),
    auctionType: o.auctionType as Lot["auctionType"],
    startingPrice: String(o.startingPrice),
    reservePrice: o.reservePrice == null ? null : String(o.reservePrice),
    buyNowPrice: o.buyNowPrice == null ? null : String(o.buyNowPrice),
    currentPrice: String(o.currentPrice),
    buyerPremiumRate:
      o.buyerPremiumRate == null || o.buyerPremiumRate === "" ? "0.25" : String(o.buyerPremiumRate),
    ...(checkoutPricing !== undefined ? { checkoutPricing } : {}),
    minBidIncrement:
      o.minBidIncrement == null || o.minBidIncrement === "" ? "1.00" : String(o.minBidIncrement),
    dutchDecrementAmount:
      o.dutchDecrementAmount == null || o.dutchDecrementAmount === ""
        ? null
        : String(o.dutchDecrementAmount),
    dutchDecrementIntervalMs:
      typeof o.dutchDecrementIntervalMs === "number" && Number.isFinite(o.dutchDecrementIntervalMs)
        ? o.dutchDecrementIntervalMs
        : 60_000,
    dutchLastDecrementAt: o.dutchLastDecrementAt == null ? null : toDate(o.dutchLastDecrementAt),
    startTime: toDate(o.startTime),
    endTime: toDate(o.endTime),
    status: o.status as Lot["status"],
    winnerId: o.winnerId == null ? null : String(o.winnerId),
    createdAt: toDate(o.createdAt),
    updatedAt: toDate(o.updatedAt),
    marketingDetails: parseMarketingDetails(o.marketingDetails),
  };
}

export function parseNotificationPreference(raw: unknown): NotificationPreference {
  const o = raw as Record<string, unknown>;
  return {
    userId: String(o.userId),
    outbidInApp: Boolean(o.outbidInApp),
    wonInApp: Boolean(o.wonInApp),
    lostInApp: Boolean(o.lostInApp),
    endingSoonInApp: Boolean(o.endingSoonInApp),
    watchlistInApp: Boolean(o.watchlistInApp),
    paymentInApp: Boolean(o.paymentInApp),
    outbidPush: Boolean(o.outbidPush),
    wonPush: Boolean(o.wonPush),
    endingSoonPush: Boolean(o.endingSoonPush),
    outbidEmail: Boolean(o.outbidEmail),
    wonEmail: o.wonEmail !== false,
    lostEmail: o.lostEmail !== false,
    endingSoonEmail: o.endingSoonEmail !== false,
    watchlistEmail: Boolean(o.watchlistEmail),
    paymentEmail: o.paymentEmail !== false,
    lotEndedSellerEmail: o.lotEndedSellerEmail !== false,
    outbidWhatsapp: Boolean(o.outbidWhatsapp),
    wonWhatsapp: Boolean(o.wonWhatsapp),
    lostWhatsapp: Boolean(o.lostWhatsapp),
    endingSoonWhatsapp: Boolean(o.endingSoonWhatsapp),
    watchlistWhatsapp: Boolean(o.watchlistWhatsapp),
    paymentWhatsapp: Boolean(o.paymentWhatsapp),
    lotEndedSellerWhatsapp: Boolean(o.lotEndedSellerWhatsapp),
    quietStart: o.quietStart == null || o.quietStart === "" ? null : String(o.quietStart),
    quietEnd: o.quietEnd == null || o.quietEnd === "" ? null : String(o.quietEnd),
    updatedAt: toDate(o.updatedAt),
  };
}

export function parseUserNotification(raw: unknown): UserNotification {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    userId: String(o.userId),
    type: String(o.type),
    title: String(o.title),
    message: String(o.message),
    lotId: o.lotId != null ? String(o.lotId) : o.auctionId != null ? String(o.auctionId) : null,
    read: Boolean(o.read),
    archivedAt: o.archivedAt == null || o.archivedAt === "" ? null : toDate(o.archivedAt),
    createdAt: toDate(o.createdAt),
  };
}

function isItemSubmissionStatus(s: string): s is ItemSubmissionStatus {
  return (itemSubmissionStatuses as readonly string[]).includes(s);
}

export function parseItemSubmission(raw: unknown): ItemSubmission {
  const o = raw as Record<string, unknown>;
  const status =
    typeof o.status === "string" && isItemSubmissionStatus(o.status) ? o.status : "draft";
  const legalEntityId =
    o.legalEntityId == null || o.legalEntityId === "" ? undefined : String(o.legalEntityId);
  const sellerId = o.sellerId == null || o.sellerId === "" ? undefined : String(o.sellerId);

  return {
    id: String(o.id),
    ...(legalEntityId ? { legalEntityId } : {}),
    ...(sellerId ? { sellerId } : {}),
    title: String(o.title),
    description: o.description == null || o.description === "" ? null : String(o.description),
    medium: o.medium == null || o.medium === "" ? null : String(o.medium),
    dimensions: o.dimensions == null || o.dimensions === "" ? null : String(o.dimensions),
    images: Array.isArray(o.images) ? (o.images as unknown[]).map(String) : [],
    yearOfWork: o.yearOfWork == null || o.yearOfWork === "" ? null : String(o.yearOfWork),
    isSigned: Boolean(o.isSigned),
    signatureNote:
      o.signatureNote == null || o.signatureNote === "" ? null : String(o.signatureNote),
    edition: o.edition == null || o.edition === "" ? null : String(o.edition),
    conditionSelfReport:
      o.conditionSelfReport == null || o.conditionSelfReport === ""
        ? null
        : String(o.conditionSelfReport),
    provenance: Array.isArray(o.provenance)
      ? (o.provenance as { period?: string; note: string }[])
      : [],
    exhibitions: Array.isArray(o.exhibitions)
      ? (o.exhibitions as { year?: string; venue: string; note?: string }[])
      : [],
    askingPrice: o.askingPrice == null || o.askingPrice === "" ? null : String(o.askingPrice),
    reservePrice: o.reservePrice == null || o.reservePrice === "" ? null : String(o.reservePrice),
    categoryIds: Array.isArray(o.categoryIds) ? (o.categoryIds as unknown[]).map(String) : [],
    categoryId: String(o.categoryId ?? ""),
    submitterNotes:
      o.submitterNotes == null || o.submitterNotes === "" ? null : String(o.submitterNotes),
    status,
    reviewedBy: o.reviewedBy == null || o.reviewedBy === "" ? null : String(o.reviewedBy),
    reviewedAt: o.reviewedAt == null || o.reviewedAt === "" ? null : toDate(o.reviewedAt),
    reviewNotes: o.reviewNotes == null || o.reviewNotes === "" ? null : String(o.reviewNotes),
    rejectionReason:
      o.rejectionReason == null || o.rejectionReason === "" ? null : String(o.rejectionReason),
    convertedLotId:
      o.convertedLotId == null || o.convertedLotId === "" ? null : String(o.convertedLotId),
    createdAt: toDate(o.createdAt),
    updatedAt: toDate(o.updatedAt),
  };
}

export function parseBid(raw: unknown): Bid {
  const o = raw as Record<string, unknown>;
  const placedByUserId =
    o.placedByUserId == null || o.placedByUserId === "" ? undefined : String(o.placedByUserId);
  const bidderId = o.bidderId == null || o.bidderId === "" ? placedByUserId : String(o.bidderId);
  return {
    id: String(o.id),
    lotId: String(o.lotId ?? o.auctionId),
    ...(bidderId ? { bidderId } : {}),
    ...(placedByUserId ? { placedByUserId } : {}),
    amount: String(o.amount),
    isWinning: Boolean(o.isWinning),
    isAutoBid: Boolean(o.isAutoBid),
    maxAutoBidAmount: o.maxAutoBidAmount == null ? null : String(o.maxAutoBidAmount),
    autoBidStepAmount: o.autoBidStepAmount == null ? null : String(o.autoBidStepAmount),
    createdAt: toDate(o.createdAt),
  };
}
