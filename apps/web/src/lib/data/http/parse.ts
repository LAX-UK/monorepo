import type {
  Bid,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
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

function parseSaleDeliveryMode(raw: unknown): Sale["deliveryMode"] {
  const v = typeof raw === "string" ? raw : "";
  if (v === "online" || v === "onsite" || v === "hybrid") return v;
  return "onsite";
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
    streamUrl:
      o.streamUrl == null || o.streamUrl === "" ? null : String(o.streamUrl),
    status: o.status as Sale["status"],
    startTime: toDate(o.startTime),
    endTime: toDate(o.endTime),
    previewStartTime:
      o.previewStartTime == null || o.previewStartTime === "" ? null : toDate(o.previewStartTime),
    buyerPremiumRate:
      o.buyerPremiumRate == null || o.buyerPremiumRate === "" ? "0.25" : String(o.buyerPremiumRate),
    terms: o.terms == null || o.terms === "" ? null : String(o.terms),
    createdBy: String(o.createdBy ?? ""),
    createdAt: toDate(o.createdAt),
    updatedAt: toDate(o.updatedAt),
  };
}

export function parseLot(raw: unknown): Lot {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    saleId: o.saleId == null || o.saleId === "" ? null : String(o.saleId),
    lotNumber:
      o.lotNumber == null || o.lotNumber === ""
        ? null
        : typeof o.lotNumber === "number"
          ? o.lotNumber
          : Number.parseInt(String(o.lotNumber), 10),
    sellerId: String(o.sellerId),
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
  return {
    id: String(o.id),
    sellerId: String(o.sellerId ?? ""),
    title: String(o.title),
    description: o.description == null || o.description === "" ? null : String(o.description),
    medium: o.medium == null || o.medium === "" ? null : String(o.medium),
    dimensions: o.dimensions == null || o.dimensions === "" ? null : String(o.dimensions),
    images: Array.isArray(o.images) ? (o.images as unknown[]).map(String) : [],
    askingPrice: o.askingPrice == null || o.askingPrice === "" ? null : String(o.askingPrice),
    reservePrice: o.reservePrice == null || o.reservePrice === "" ? null : String(o.reservePrice),
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
  return {
    id: String(o.id),
    lotId: String(o.lotId ?? o.auctionId),
    bidderId: String(o.bidderId),
    amount: String(o.amount),
    isWinning: Boolean(o.isWinning),
    isAutoBid: Boolean(o.isAutoBid),
    maxAutoBidAmount: o.maxAutoBidAmount == null ? null : String(o.maxAutoBidAmount),
    createdAt: toDate(o.createdAt),
  };
}
