import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import type { CoverLotOption, CoverView } from "@/lib/admin/sale-cover/cover-view";
import { getAdminSaleCover } from "@/lib/data/http/admin-sale-cover.server";
import type { SaleStatus } from "@auction/types";
import { notFound } from "next/navigation";

export type SaleCoverPageModel = {
  saleId: string;
  saleTitle: string;
  saleStatus: SaleStatus;
  view: CoverView;
  lots: CoverLotOption[];
};

/** Data/composition boundary for `/admin/sales/[id]/cover`. A failed read throws to the tab's error state. */
export async function loadAdminSaleCoverPage(saleId: string): Promise<SaleCoverPageModel> {
  const [bundle, view] = await Promise.all([
    loadAdminSaleDetail(saleId),
    getAdminSaleCover(saleId),
  ]);
  if (!view) notFound();
  const lots = [...bundle.lots]
    .sort(
      (a, b) => (a.lotNumber ?? Number.MAX_SAFE_INTEGER) - (b.lotNumber ?? Number.MAX_SAFE_INTEGER),
    )
    .map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber ?? null,
      title: lot.title,
      images: lot.images,
      dimensions: lot.dimensions ?? null,
    }));
  return { saleId, saleTitle: bundle.sale.title, saleStatus: bundle.sale.status, view, lots };
}
