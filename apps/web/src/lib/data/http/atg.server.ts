import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type AtgIntegrationStatus,
  type AtgLotSyncView,
  type AtgOwnershipState,
  type AtgSaleSyncView,
  type SaleStatus,
  resolveSaleSellingPlatform,
} from "@auction/types";

const ATG_BASE = "/admin/integrations/atg";

export async function getAtgIntegrationStatus(): Promise<AtgIntegrationStatus> {
  const res = await authedServerFetch(`${ATG_BASE}/status`, { skipActingLegalEntityHeader: true });
  if (!res.ok) throw new Error(`Failed to load ATG status: ${res.status}`);
  const body = (await res.json()) as { data: AtgIntegrationStatus };
  return body.data;
}

export async function getAtgSaleSyncView(saleId: string): Promise<AtgSaleSyncView | null> {
  const res = await authedServerFetch(`${ATG_BASE}/sales/${encodeURIComponent(saleId)}`, {
    skipActingLegalEntityHeader: true,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load ATG sale sync: ${res.status}`);
  const body = (await res.json()) as { data: AtgSaleSyncView };
  return body.data;
}

/** ATG link state for one lot, or null when the lot is not on ATG or the viewer lacks access. */
export async function getAtgLotSyncView(
  saleId: string | null,
  lotId: string,
): Promise<AtgLotSyncView | null> {
  if (!saleId) return null;
  const view = await getAtgSaleSyncView(saleId).catch(() => null);
  const lot = view?.lots.find((row) => row.lotId === lotId);
  return lot?.atgLotId ? lot : null;
}

/**
 * Selling platform for header chips, publish guards and edit alerts. Null when ATG sync is off
 * or the lookup fails. Only draft sales can belong to ATG, so other statuses skip the fetch.
 */
export async function getAtgSaleSellingPlatform(sale: {
  id: string;
  status: SaleStatus;
}): Promise<AtgOwnershipState | null> {
  const status = await getAtgIntegrationStatus().catch(() => null);
  if (!status?.enabled) return null;
  if (sale.status !== "draft") {
    return resolveSaleSellingPlatform({
      saleStatus: sale.status,
      atgRemoteStatus: null,
      atgLinked: false,
      atgSoldLotCount: 0,
    });
  }
  const view = await getAtgSaleSyncView(sale.id).catch(() => null);
  return view?.sellingPlatform ?? null;
}
