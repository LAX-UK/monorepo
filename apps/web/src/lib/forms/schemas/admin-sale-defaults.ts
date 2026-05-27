import type { Sale } from "@auction/types";
import {
  DEFAULT_AUCTION_ZONE,
  toDatetimeFormString,
  tzDateFromParts,
} from "@auction/ui/lib/datetime";
import { TZDate } from "@date-fns/tz";
import { addDays, addHours } from "date-fns";
import type { AdminSaleFormValues } from "./admin-sale-form";

export type SaleWithPresentedCovers = Sale & { coverImagePresentedUrls?: string[] };

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

/** Maps storage keys to resolved thumbnail URLs for admin image fields. */
export function buildCoverImagePreviewMap(
  coverImages: string[],
  coverImagePresentedUrls: string[] = [],
): Record<string, string> {
  const map: Record<string, string> = {};
  coverImages.forEach((key, i) => {
    const url = coverImagePresentedUrls[i];
    if (url) map[key] = url;
  });
  return map;
}

export function saleToAdminSaleFormValues(sale: Sale): AdminSaleFormValues {
  return {
    title: sale.title,
    description: sale.description ?? "",
    coverImages: sale.coverImages,
    categoryId: sale.categoryId ?? "",
    deliveryMode: sale.deliveryMode,
    streamUrl: sale.streamUrl ?? "",
    locationName: sale.locationName ?? "",
    locationAddress: sale.locationAddress ?? "",
    locationMapUrl: sale.locationMapUrl ?? "",
    locationAddressLine1: sale.locationAddressLine1 ?? "",
    locationAddressLine2: sale.locationAddressLine2 ?? "",
    locationCity: sale.locationCity ?? "",
    locationCounty: sale.locationCounty ?? "",
    locationPostcode: sale.locationPostcode ?? "",
    locationCountry: sale.locationCountry ?? "",
    startTime: toDatetimeFormString(sale.startTime),
    endTime: toDatetimeFormString(sale.endTime),
    previewStartTime: sale.previewStartTime ? toDatetimeFormString(sale.previewStartTime) : "",
    buyerPremiumRate: sale.buyerPremiumRate,
    buyerPremiumTiers: (sale.buyerPremiumTiers ?? []).map((t) => ({
      hammerThresholdMajor: String(t.hammerThresholdMinor / 100),
      rate: t.rate,
    })),
    terms: sale.terms ?? "",
  };
}

export function emptyAdminSaleFormValues(): AdminSaleFormValues {
  const { start, end } = defaultScheduleInstants();
  return {
    title: "",
    description: "",
    coverImages: [],
    categoryId: "",
    deliveryMode: "onsite",
    streamUrl: "",
    locationName: "",
    locationAddress: "",
    locationMapUrl: "",
    locationAddressLine1: "",
    locationAddressLine2: "",
    locationCity: "",
    locationCounty: "",
    locationPostcode: "",
    locationCountry: "United Kingdom",
    startTime: toDatetimeFormString(start),
    endTime: toDatetimeFormString(end),
    previewStartTime: "",
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: [],
    terms: "",
  };
}
