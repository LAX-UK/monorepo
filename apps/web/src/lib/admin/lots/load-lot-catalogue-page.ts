import "server-only";

import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";

export type LotCataloguePageModel = {
  lotId: string;
  redirectHref: string;
};

/** Data/composition boundary for `/admin/lots/[id]/catalogue` (redirect to overview anchor). */
export async function loadAdminLotCataloguePage(lotId: string): Promise<LotCataloguePageModel> {
  await loadAdminLotDetail(lotId);

  return {
    lotId,
    redirectHref: `/admin/lots/${lotId}#catalogue`,
  };
}
