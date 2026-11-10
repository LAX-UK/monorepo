import "server-only";

import { getAdminSaleById } from "@/lib/data/http/admin.server";
import { getAtgIntegrationStatus, getAtgSaleSyncView } from "@/lib/data/http/atg.server";
import type { AtgIntegrationStatus, AtgSaleSyncView } from "@auction/types";
import { DEFAULT_SALE_TIME_ZONE } from "@auction/validators";

export type SaleAtgPageModel = {
  saleId: string;
  status: AtgIntegrationStatus;
  view: AtgSaleSyncView;
  /** The sale's own time zone, which ATG shows the auction in. */
  timeZone: string;
};

/** Data/composition boundary for `/admin/sales/[id]/atg`. Null when the sale has no ATG view. */
export async function loadAdminSaleAtgPage(saleId: string): Promise<SaleAtgPageModel | null> {
  const [status, view, sale] = await Promise.all([
    getAtgIntegrationStatus(),
    getAtgSaleSyncView(saleId),
    getAdminSaleById(saleId),
  ]);
  if (!view) return null;
  return { saleId, status, view, timeZone: sale?.sale.timeZone ?? DEFAULT_SALE_TIME_ZONE };
}
