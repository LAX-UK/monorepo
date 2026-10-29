import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type {
  AtgIntegrationStatus,
  AtgLotSellingSummary,
  AtgLotSyncView,
  AtgOwnershipState,
  AtgSaleSellingSummary,
  AtgSaleSyncView,
  SaleStatus,
} from "@auction/types";
import { toAtgSaleSellingSummary } from "@auction/types";

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

async function getSellingSummaries<T>(
  kind: "sales" | "lots",
  ids: readonly string[],
): Promise<Map<string, T>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const res = await authedServerFetch(
    `${ATG_BASE}/selling/${kind}?ids=${encodeURIComponent(unique.join(","))}`,
    { skipActingLegalEntityHeader: true },
  ).catch(() => null);
  if (!res?.ok) return new Map();
  const body = (await res.json().catch(() => null)) as { data?: Record<string, T> } | null;
  return new Map(Object.entries(body?.data ?? {}));
}

/**
 * Where each sale sells, in one request per list page. Empty when the viewer lacks ATG access or
 * the lookup fails, so lists and headers show no marker. Served while ATG sync is off.
 */
export function getAtgSaleSellingSummaries(
  saleIds: readonly string[],
): Promise<Map<string, AtgSaleSellingSummary>> {
  return getSellingSummaries<AtgSaleSellingSummary>("sales", saleIds);
}

/** Where each lot sells (with its sale's summary), in one request per list page. */
export function getAtgLotSellingSummaries(
  lotIds: readonly string[],
): Promise<Map<string, AtgLotSellingSummary>> {
  return getSellingSummaries<AtgLotSellingSummary>("lots", lotIds);
}

/**
 * A sale header's selling summary. Only draft sales can be linked to or owned by ATG, so other
 * statuses resolve locally without a request. Null when the lookup fails.
 */
export async function getAtgSaleSellingSummary(sale: {
  id: string;
  status: SaleStatus;
}): Promise<AtgSaleSellingSummary | null> {
  if (sale.status !== "draft") {
    return toAtgSaleSellingSummary({
      saleStatus: sale.status,
      atgRemoteStatus: null,
      atgLinked: false,
      atgSoldLotCount: 0,
      atgApprovedAt: null,
    });
  }
  return (await getAtgSaleSellingSummaries([sale.id])).get(sale.id) ?? null;
}

/**
 * Selling platform for publish guards and edit alerts, from the same inputs as the server guards.
 * Links count while ATG sync is off, as they do on the server. Null when the lookup fails.
 */
export async function getAtgSaleSellingPlatform(sale: {
  id: string;
  status: SaleStatus;
}): Promise<AtgOwnershipState | null> {
  return (await getAtgSaleSellingSummary(sale))?.sellingPlatform ?? null;
}
