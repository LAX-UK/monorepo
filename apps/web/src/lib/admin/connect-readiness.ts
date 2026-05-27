import "server-only";

import {
  type ConnectRequiredByLotId,
  lotConnectRequired,
} from "@/lib/admin/connect-readiness-shared";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import type { LegalEntity, Lot } from "@auction/types";
import { cache } from "react";

export type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
export { lotConnectRequired } from "@/lib/admin/connect-readiness-shared";

/** Mirrors {@link isSellerConnectReady} in apps/api/src/lib/seller-connect-readiness.ts */
export function isSellerConnectReady(entity: LegalEntity): boolean {
  return (
    entity.status === "approved" &&
    entity.stripeConnectPayoutsEnabled &&
    (entity.stripeConnectRequirementsCurrentlyDue ?? []).length === 0
  );
}

/** When Stripe Connect enforcement is active in the API (stripeConnectService.isConfigured). */
export function isStripeConnectEnforcedOnPublish(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Lots without sellerLegalEntityId skip Connect checks (see docs/runbooks/monitoring-alerts.md). */

function isConnectBlockedForSeller(seller: LegalEntity | null | undefined): boolean {
  if (!seller) return true;
  return !isSellerConnectReady(seller);
}

export async function buildConnectRequiredByLotId(
  lots: readonly Lot[],
): Promise<ConnectRequiredByLotId> {
  const record: ConnectRequiredByLotId = {};
  if (!isStripeConnectEnforcedOnPublish()) {
    for (const lot of lots) {
      record[lot.id] = false;
    }
    return record;
  }

  const sellerIds = [
    ...new Set(lots.map((l) => l.sellerLegalEntityId).filter((id): id is string => Boolean(id))),
  ];
  const sellers = new Map<string, LegalEntity | null>();
  await Promise.all(
    sellerIds.map(async (id) => {
      const entity = await getAdminLegalEntityById(id).catch(() => null);
      sellers.set(id, entity);
    }),
  );

  for (const lot of lots) {
    if (!lot.sellerLegalEntityId) {
      record[lot.id] = false;
      continue;
    }
    const seller = sellers.get(lot.sellerLegalEntityId);
    record[lot.id] = isConnectBlockedForSeller(seller);
  }
  return record;
}

/** Per-request cached connect flag for a single lot (dedupes layout + tab routes). */
export const loadLotConnectRequired = cache(async (lotId: string): Promise<boolean> => {
  const { auction } = await loadAdminLotDetail(lotId);
  const connectRequiredByLotId = await buildConnectRequiredByLotId([auction]);
  return lotConnectRequired(connectRequiredByLotId, lotId);
});

/** Per-request cached connect flags for all lots in a sale (dedupes layout + tab routes). */
export const loadSaleConnectRequiredByLotId = cache(
  async (saleId: string): Promise<ConnectRequiredByLotId> => {
    const { loadAdminSaleDetail } = await import("@/lib/admin/load-sale-detail");
    const bundle = await loadAdminSaleDetail(saleId);
    return buildConnectRequiredByLotId(bundle.lots);
  },
);
