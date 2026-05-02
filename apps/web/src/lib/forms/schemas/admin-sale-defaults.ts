import type { Sale } from "@auction/types";
import { toDatetimeLocalValue } from "./admin-lot-defaults";
import type { AdminSaleFormValues } from "./admin-sale-form";

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
    startTime: toDatetimeLocalValue(sale.startTime),
    endTime: toDatetimeLocalValue(sale.endTime),
    previewStartTime: sale.previewStartTime ? toDatetimeLocalValue(sale.previewStartTime) : "",
    buyerPremiumRate: sale.buyerPremiumRate,
    terms: sale.terms ?? "",
  };
}

export function emptyAdminSaleFormValues(): AdminSaleFormValues {
  const s = new Date();
  s.setHours(s.getHours() + 1, 0, 0, 0);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
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
    startTime: toDatetimeLocalValue(s),
    endTime: toDatetimeLocalValue(e),
    previewStartTime: "",
    buyerPremiumRate: "0.25",
    terms: "",
  };
}
