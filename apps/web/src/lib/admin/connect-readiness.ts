import "server-only";

import {
  type ConnectRequiredByLotId,
  lotConnectRequired,
} from "@/lib/admin/connect-readiness-shared";
import { loadAdminLotDetail } from "@/lib/admin/load-lot-detail";
import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import {
  isSellerConnectReady as isSellerConnectReadyFromPackage,
  shouldSkipConnect,
} from "@auction/connect";
import type { LegalEntity, Lot } from "@auction/types";
import { cache } from "react";

export type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness-shared";
export { lotConnectRequired } from "@/lib/admin/connect-readiness-shared";
export { shouldSkipConnect } from "@auction/connect";

/** Build connect map from API-provided list flags (no extra HTTP). */
export function connectRequiredFromLots(
  lots: ReadonlyArray<{ id: string; connectRequired?: boolean | null | undefined }>,
): ConnectRequiredByLotId {
  const record: ConnectRequiredByLotId = {};
  for (const lot of lots) {
    record[lot.id] = lot.connectRequired === true;
  }
  return record;
}

/** Business gate for publish + settlement (shared with API via @auction/connect). */
export function isSellerConnectReady(entity: LegalEntity): boolean {
  return isSellerConnectReadyFromPackage(entity);
}

/** When Stripe Connect enforcement is active in the API (stripeConnectService.isConfigured). */
export const isStripeConnectEnforcedOnPublish = cache(
  async function isStripeConnectEnforcedOnPublish(): Promise<boolean> {
    const config = await getServerStripeConnectClientConfig();
    return config.connectEnforced;
  },
);

function isConnectBlockedForSeller(seller: LegalEntity | null | undefined): boolean {
  if (!seller) return true;
  if (shouldSkipConnect(seller)) return false;
  return !isSellerConnectReady(seller);
}

export async function buildConnectRequiredByLotId(
  lots: readonly Lot[],
): Promise<ConnectRequiredByLotId> {
  if (
    lots.length > 0 &&
    lots.every((lot) => (lot as Lot & { connectRequired?: boolean }).connectRequired !== undefined)
  ) {
    return connectRequiredFromLots(
      lots as ReadonlyArray<{ id: string; connectRequired?: boolean | null | undefined }>,
    );
  }

  const record: ConnectRequiredByLotId = {};
  if (!(await isStripeConnectEnforcedOnPublish())) {
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
