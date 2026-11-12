import { defaultScheduleInstants } from "@auction/datetime";
import type { Sale } from "@auction/types";
import { toDatetimeFormString } from "@auction/ui/lib/datetime";
import { DEFAULT_SALE_TIME_ZONE } from "@auction/validators";
import type { AdminSaleFormValues } from "./admin-sale-form";

export type SaleWithPresentedCovers = Sale & { coverImagePresentedUrls?: string[] };

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
    isTest: sale.isTest === true,
    deliveryMode: sale.deliveryMode,
    requireSaleroomGoLiveBeforeOnlineBids: !sale.allowOnlineBidsBeforeGoLive,
    streamUrl: sale.streamUrl ?? "",
    heroPresentation: sale.heroPresentation,
    heroVideoUrl: sale.heroVideoUrl ?? "",
    locationName: sale.locationName ?? "",
    locationAddress: sale.locationAddress ?? "",
    locationMapUrl: sale.locationMapUrl ?? "",
    locationAddressLine1: sale.locationAddressLine1 ?? "",
    locationAddressLine2: sale.locationAddressLine2 ?? "",
    locationCity: sale.locationCity ?? "",
    locationCounty: sale.locationCounty ?? "",
    locationPostcode: sale.locationPostcode ?? "",
    locationCountry: sale.locationCountry ?? "",
    venueId: sale.venueId ?? "",
    timeZone: sale.timeZone,
    startTime: toDatetimeFormString(sale.startTime, sale.timeZone),
    endTime: toDatetimeFormString(sale.endTime, sale.timeZone),
    previewStartTime: sale.previewStartTime
      ? toDatetimeFormString(sale.previewStartTime, sale.timeZone)
      : "",
    buyerPremiumRate: sale.buyerPremiumRate,
    buyerPremiumTiers: (sale.buyerPremiumTiers ?? []).map((t) => ({
      hammerThresholdMajor: String(t.hammerThresholdMinor / 100),
      rate: t.rate,
    })),
    terms: sale.terms ?? "",
  };
}

export function emptyAdminSaleFormValues(
  timeZone: string = DEFAULT_SALE_TIME_ZONE,
): AdminSaleFormValues {
  const { start, end } = defaultScheduleInstants(new Date(), timeZone);
  return {
    title: "",
    description: "",
    coverImages: [],
    categoryId: "",
    isTest: false,
    deliveryMode: "onsite",
    requireSaleroomGoLiveBeforeOnlineBids: true,
    streamUrl: "",
    heroPresentation: "cover",
    heroVideoUrl: "",
    locationName: "",
    locationAddress: "",
    locationMapUrl: "",
    locationAddressLine1: "",
    locationAddressLine2: "",
    locationCity: "",
    locationCounty: "",
    locationPostcode: "",
    locationCountry: "United Kingdom",
    venueId: "",
    timeZone,
    startTime: toDatetimeFormString(start, timeZone),
    endTime: toDatetimeFormString(end, timeZone),
    previewStartTime: "",
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: [],
    terms: "",
  };
}
