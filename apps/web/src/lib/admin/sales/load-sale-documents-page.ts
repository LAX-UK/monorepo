import "server-only";

import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import { getServerSaleDocuments } from "@/lib/data/http/sale-documents.server";
import type { EntityDocument } from "@auction/types";

export type SaleDocumentsPageModel = {
  saleId: string;
  saleTitle: string;
  documents: EntityDocument[];
};

/** Data/composition boundary for `/admin/sales/[id]/documents`. */
export async function loadAdminSaleDocumentsPage(saleId: string): Promise<SaleDocumentsPageModel> {
  const bundle = await loadAdminSaleDetail(saleId);
  const documents = await getServerSaleDocuments(saleId).catch(() => []);

  return {
    saleId,
    saleTitle: bundle.sale.title,
    documents,
  };
}
