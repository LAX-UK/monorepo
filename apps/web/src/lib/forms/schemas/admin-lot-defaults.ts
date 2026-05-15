import type { Lot } from "@auction/types";
import type { AdminLotFormValues } from "./admin-lot-form";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
    saleId: auction.saleId ?? null,
    lotNumber: auction.lotNumber ?? null,
    auctionType: auction.auctionType,
    startingPrice: auction.startingPrice,
    reservePrice: auction.reservePrice ?? "",
    buyNowPrice: auction.buyNowPrice ?? "",
    buyerPremiumRate: auction.buyerPremiumRate,
    minBidIncrement: auction.minBidIncrement,
    dutchDecrementAmount: auction.dutchDecrementAmount ?? "",
    dutchDecrementIntervalMs: String(auction.dutchDecrementIntervalMs),
    images: auction.images,
    imageAlts: auction.images.map((_, index) => auction.marketingDetails.imageAlts?.[index] ?? ""),
    startTime: toDatetimeLocalValue(auction.startTime),
    endTime: toDatetimeLocalValue(auction.endTime),
    artistId: auction.artistId ?? null,
  };
}

export function emptyAdminLotFormValues(): AdminLotFormValues {
  const s = new Date();
  s.setHours(s.getHours() + 1, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  return {
    title: "",
    description: "",
    medium: "",
    dimensions: "",
    sellerLegalEntityId: "",
    sellerDisplayName: undefined,
    categoryIds: [],
    saleId: null,
    lotNumber: null,
    auctionType: "english",
    startingPrice: "0.00",
    reservePrice: "",
    buyNowPrice: "",
    buyerPremiumRate: "",
    minBidIncrement: "",
    dutchDecrementAmount: "",
    dutchDecrementIntervalMs: "60000",
    images: [],
    imageAlts: [],
    startTime: toDatetimeLocalValue(s),
    endTime: toDatetimeLocalValue(e),
    artistId: null,
  };
}
