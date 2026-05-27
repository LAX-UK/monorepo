import type { Lot } from "@auction/types";
import {
  DEFAULT_AUCTION_ZONE,
  toDatetimeFormString,
  tzDateFromParts,
} from "@auction/ui/lib/datetime";
import { TZDate } from "@date-fns/tz";
import { addDays, addHours } from "date-fns";
import type { AdminLotFormValues } from "./admin-lot-form";

function defaultScheduleInstants(): { start: Date; end: Date } {
  const now = new TZDate(new Date(), DEFAULT_AUCTION_ZONE);
  const startTz = tzDateFromParts(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    addHours(now, 1).getHours(),
    0,
    DEFAULT_AUCTION_ZONE,
  );
  const start = new Date(startTz.getTime());
  const endTz = tzDateFromParts(
    addDays(startTz, 7).getFullYear(),
    addDays(startTz, 7).getMonth() + 1,
    addDays(startTz, 7).getDate(),
    startTz.getHours(),
    0,
    DEFAULT_AUCTION_ZONE,
  );
  return { start, end: new Date(endTz.getTime()) };
}

export function lotToAdminLotFormValues(auction: Lot): AdminLotFormValues {
  const categoryIds =
    auction.categoryIds && auction.categoryIds.length > 0
      ? auction.categoryIds
      : auction.categoryId
        ? [auction.categoryId]
        : [];
  return {
    title: auction.title,
    description: auction.description ?? "",
    medium: auction.medium ?? "",
    dimensions: auction.dimensions ?? "",
    sellerLegalEntityId: auction.sellerLegalEntityId ?? "",
    sellerDisplayName: undefined,
    categoryIds,
    saleId: auction.saleId ?? "",
    lotNumber: auction.lotNumber ?? null,
    auctionType: auction.auctionType,
    startingPrice: auction.startingPrice,
    reservePrice: auction.reservePrice ?? "",
    buyNowPrice: auction.buyNowPrice ?? "",
    buyerPremiumRate: auction.buyerPremiumRate,
    minBidIncrement: auction.minBidIncrement,
    autoBidEnabled: auction.autoBidEnabled ?? true,
    autoBidStepMin: auction.autoBidStepMin ?? "",
    autoBidStepMax: auction.autoBidStepMax ?? "",
    autoBidStepPresetsCsv:
      auction.autoBidStepPresets?.map((n) => n.toFixed(2).replace(/\.?0+$/, "")).join(", ") ?? "",
    dutchDecrementAmount: auction.dutchDecrementAmount ?? "",
    dutchDecrementIntervalMs: String(auction.dutchDecrementIntervalMs),
    images: auction.images,
    imageAlts: auction.images.map((_, index) => auction.marketingDetails.imageAlts?.[index] ?? ""),
    startTime: toDatetimeFormString(auction.startTime),
    endTime: toDatetimeFormString(auction.endTime),
    artistId: auction.artistId ?? null,
  };
}

export function emptyAdminLotFormValues(): AdminLotFormValues {
  const { start, end } = defaultScheduleInstants();
  return {
    title: "",
    description: "",
    medium: "",
    dimensions: "",
    sellerLegalEntityId: "",
    sellerDisplayName: undefined,
    categoryIds: [],
    saleId: "",
    lotNumber: null,
    auctionType: "english",
    startingPrice: "0.00",
    reservePrice: "",
    buyNowPrice: "",
    buyerPremiumRate: "",
    minBidIncrement: "",
    autoBidEnabled: true,
    autoBidStepMin: "",
    autoBidStepMax: "",
    autoBidStepPresetsCsv: "",
    dutchDecrementAmount: "",
    dutchDecrementIntervalMs: "60000",
    images: [],
    imageAlts: [],
    startTime: toDatetimeFormString(start),
    endTime: toDatetimeFormString(end),
    artistId: null,
  };
}
