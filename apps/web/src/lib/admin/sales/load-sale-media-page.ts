import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import type { Sale, SaleDayMediaRef } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type SaleMediaPageModel = {
  saleId: string;
  saleTitle: string;
  saleStatus: Sale["status"];
  initialDayImages: SaleDayMediaRef[];
  previewUrlByKey: Record<string, string>;
  notFound: boolean;
};

/** Data/composition boundary for `/admin/sales/[id]/media`. */
export async function loadAdminSaleMediaPage(saleId: string): Promise<SaleMediaPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const { sale } = bundle;

  if (!isSaleroomDeliveryMode(sale.deliveryMode)) {
    return {
      saleId,
      saleTitle: sale.title,
      saleStatus: sale.status,
      initialDayImages: [],
      previewUrlByKey: {},
      notFound: true,
    };
  }

  const dayImages = sale.dayImages ?? [];
  const dayImagePresentedUrls =
    (bundle.sale as typeof bundle.sale & { dayImagePresentedUrls?: string[] })
      .dayImagePresentedUrls ?? [];

  const previewUrlByKey: Record<string, string> = {};
  dayImages.forEach((ref, i) => {
    const url = dayImagePresentedUrls[i];
    if (url) previewUrlByKey[ref.key] = url;
  });

  return {
    saleId,
    saleTitle: sale.title,
    saleStatus: sale.status,
    initialDayImages: dayImages,
    previewUrlByKey,
    notFound: false,
  };
}
