import { defaultScheduleInstants } from "@auction/datetime";
import type { LotWithSaleZone } from "@auction/types";
import { toDatetimeFormString } from "@auction/ui/lib/datetime";
import { DEFAULT_SALE_TIME_ZONE } from "@auction/validators";
import type { AdminLotFormValues } from "./admin-lot-form";

export function lotToAdminLotFormValues(auction: LotWithSaleZone): AdminLotFormValues {
  const timeZone = auction.timeZone ?? DEFAULT_SALE_TIME_ZONE;
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
    photoIncludesFrame: auction.photoIncludesFrame ?? false,
    framedWidthCm: auction.framedWidthCm != null ? String(auction.framedWidthCm) : "",
    framedHeightCm: auction.framedHeightCm != null ? String(auction.framedHeightCm) : "",
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
    timeZone,
    startTime: toDatetimeFormString(auction.startTime, timeZone),
    endTime: toDatetimeFormString(auction.endTime, timeZone),
    artistId: auction.artistId ?? null,
  };
}

export function emptyAdminLotFormValues(
  timeZone: string = DEFAULT_SALE_TIME_ZONE,
): AdminLotFormValues {
  const { start, end } = defaultScheduleInstants(new Date(), timeZone);
  return {
    title: "",
    description: "",
    medium: "",
    dimensions: "",
    photoIncludesFrame: false,
    framedWidthCm: "",
    framedHeightCm: "",
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
    timeZone,
    startTime: toDatetimeFormString(start, timeZone),
    endTime: toDatetimeFormString(end, timeZone),
    artistId: null,
  };
}
