import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getAtgSaleSellingSummary } from "@/lib/data/http/atg.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import {
  buildCoverImagePreviewMap,
  saleToAdminSaleFormValues,
} from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import {
  type CategoryNode,
  type EntityDocument,
  type Lot,
  type Sale,
  isSaleZoneFixedByAtg,
} from "@auction/types";

export type SaleEditPageModel = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  categories: CategoryNode[];
  saleDocuments: EntityDocument[];
  defaultValues: AdminSaleFormValues;
  previewUrlByKey: Record<string, string>;
  englishOnlyAuctionsLocked: boolean;
  /** ATG holds the auction, so the sale's time zone cannot change. */
  zoneFixedByAtg: boolean;
};

/** Data/composition boundary for `/admin/sales/[id]/edit`. */
export async function loadAdminSaleEditPage(saleId: string): Promise<SaleEditPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const { sale, lots } = bundle;

  const [categories, saleDocuments, selling] = await Promise.all([
    (async () => (await getServerCategoryReader()).tree())(),
    getServerSaleDocuments(saleId),
    getAtgSaleSellingSummary(sale),
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
    zoneFixedByAtg: selling != null && isSaleZoneFixedByAtg(selling),
  };
}
