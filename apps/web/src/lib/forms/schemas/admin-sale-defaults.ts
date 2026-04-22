import type { Sale } from "@auction/types";
import { toDatetimeLocalValue } from "./admin-lot-defaults";
import type { AdminSaleFormValues } from "./admin-sale-form";

export function saleToAdminSaleFormValues(sale: Sale): AdminSaleFormValues {
  return {
    title: sale.title,
    description: sale.description ?? "",
    coverImages: sale.coverImages.join("\n"),
    categoryId: sale.categoryId ?? "",
    deliveryMode: sale.deliveryMode,
    streamUrl: sale.streamUrl ?? "",
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
    coverImages: "",
    categoryId: "",
    deliveryMode: "onsite",
    streamUrl: "",
    startTime: toDatetimeLocalValue(s),
    endTime: toDatetimeLocalValue(e),
    previewStartTime: "",
    buyerPremiumRate: "0.25",
    terms: "",
  };
}
