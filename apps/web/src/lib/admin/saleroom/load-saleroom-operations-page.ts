import "server-only";

import { isSaleLiveish } from "@/components/admin/sale-detail/sale-detail-helpers";
import { loadAdminSaleDetail } from "@/lib/admin/load-sale-detail";
import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin-operations-snapshot.types";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin-paddle.types";
import { getAdminSalePaddleRoster } from "@/lib/data/http/admin-saleroom.reader";
import { getAdminSaleOperationsSnapshot } from "@/lib/data/http/admin-telephone.server";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type SaleroomOperationsPageModel = {
  saleId: string;
  sale: Awaited<ReturnType<typeof loadAdminSaleDetail>>["sale"];
  lots: Awaited<ReturnType<typeof loadAdminSaleDetail>>["lots"];
  liveish: boolean;
  snapshot: AdminSaleOperationsSnapshot | null;
  paddleRoster: AdminPaddleRosterEntry[];
  notFound: boolean;
};

/** Sale operations tab bundle for saleroom delivery sales. */
export async function loadSaleroomOperationsPage(
  saleId: string,
): Promise<SaleroomOperationsPageModel> {
  const bundle = await loadAdminSaleDetail(saleId).catch(() => null);
  if (!bundle || !isSaleroomDeliveryMode(bundle.sale.deliveryMode)) {
    return {
      saleId,
      sale: bundle?.sale ?? ({} as SaleroomOperationsPageModel["sale"]),
      lots: [],
      liveish: false,
      snapshot: null,
      paddleRoster: [],
      notFound: true,
    };
  }

  const [snapshot, paddleRoster] = await Promise.all([
    getAdminSaleOperationsSnapshot(saleId).catch(() => null),
    getAdminSalePaddleRoster(saleId).catch(() => []),
  ]);

  return {
    saleId,
    sale: bundle.sale,
    lots: bundle.lots,
    liveish: isSaleLiveish(bundle.sale),
    snapshot,
    paddleRoster,
    notFound: false,
  };
}
