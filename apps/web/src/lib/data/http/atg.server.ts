import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  AtgIntegrationStatus,
  AtgLotSyncView,
  AtgOwnershipState,
  AtgSaleSyncView,
  AtgSyncJobState,
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

export async function getAtgJobState(jobId: string): Promise<AtgSyncJobState | null> {
  const res = await authedServerFetch(`${ATG_BASE}/jobs/${encodeURIComponent(jobId)}`, {
    skipActingLegalEntityHeader: true,
  });
  if (res.status === 404) return "done";
  if (!res.ok) return null;
  const body = (await res.json()) as { data: { state: AtgSyncJobState } };
  return body.data.state;
}

/** Selling platform for header chips and publish guards (null when ATG is off or sale missing). */
export async function getAtgSaleSellingPlatform(saleId: string): Promise<AtgOwnershipState | null> {
  const view = await getAtgSaleSyncView(saleId).catch(() => null);
  return view?.sellingPlatform ?? null;
}
