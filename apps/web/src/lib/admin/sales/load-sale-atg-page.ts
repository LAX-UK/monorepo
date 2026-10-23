import "server-only";

import { getAtgIntegrationStatus, getAtgSaleSyncView } from "@/lib/data/http/atg.server";
import type { AtgIntegrationStatus, AtgSaleSyncView } from "@auction/types";

export type SaleAtgPageModel = {
  saleId: string;
  status: AtgIntegrationStatus;
  view: AtgSaleSyncView;
};

/** Data/composition boundary for `/admin/sales/[id]/atg`. Null when the sale has no ATG view. */
export async function loadAdminSaleAtgPage(saleId: string): Promise<SaleAtgPageModel | null> {
  const [status, view] = await Promise.all([getAtgIntegrationStatus(), getAtgSaleSyncView(saleId)]);
  if (!view) return null;
  return { saleId, status, view };
}
