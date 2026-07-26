import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  buildCoverImagePreviewMap,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { CategoryNode, EntityDocument, Lot, Sale } from "@auction/types";

export type SaleEditPageModel = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  categories: CategoryNode[];
  saleDocuments: EntityDocument[];
  defaultValues: AdminSaleFormValues;
  previewUrlByKey: Record<string, string>;
  englishOnlyAuctionsLocked: boolean;
};

/** Data/composition boundary for `/admin/sales/[id]/edit`. */
export async function loadAdminSaleEditPage(saleId: string): Promise<SaleEditPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const { sale, lots } = bundle;

  const [categories, saleDocuments] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getServerSaleDocuments(saleId),
  ]);

  const previewUrlByKey = buildCoverImagePreviewMap(
    sale.coverImages,
    "coverImagePresentedUrls" in sale
      ? (sale as { coverImagePresentedUrls?: string[] }).coverImagePresentedUrls
      : undefined,
  );

  return {
    saleId,
    sale,
    lots,
    categories,
    saleDocuments,
    defaultValues: saleToAdminSaleFormValues(sale),
    previewUrlByKey,
    englishOnlyAuctionsLocked: isEnglishOnlyAuctionsLocked(),
  };
}
