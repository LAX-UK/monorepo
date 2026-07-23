import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminSaleDetailMetrics = {
  lotCount: number;
  publishedLotCount: number;
  aggregateEstimate: string | null;
  aggregateEstimateDeltaHint: string | null;
  totalHammer: string | null;
  expectedRevenue: string | null;
  expectedRevenueHint: string | null;
  activeBidders: number | null;
  activeBiddersHint: string | null;
  bidActivityOnline: number | null;
  bidActivityRoom: number | null;
  bidActivityPhone: number | null;
  lastCatalogueSyncLabel: string | null;
  lastExportLabel: string | null;
  lastStatusChangeLabel: string | null;
};

export const EMPTY_ADMIN_SALE_DETAIL_METRICS: AdminSaleDetailMetrics = {
  lotCount: 0,
  publishedLotCount: 0,
  aggregateEstimate: null,
  aggregateEstimateDeltaHint: null,
  totalHammer: null,
  expectedRevenue: null,
  expectedRevenueHint: null,
  activeBidders: null,
  activeBiddersHint: null,
  bidActivityOnline: null,
  bidActivityRoom: null,
  bidActivityPhone: null,
  lastCatalogueSyncLabel: null,
  lastExportLabel: null,
  lastStatusChangeLabel: null,
};

export async function getAdminSaleDetailMetrics(saleId: string): Promise<AdminSaleDetailMetrics> {
  try {
    const res = await authedServerFetch(`/admin/sales/${encodeURIComponent(saleId)}/metrics`);
    if (!res.ok) throw new Error(`Failed to load sale metrics: ${res.status}`);
    const body = (await res.json()) as { data?: AdminSaleDetailMetrics };
    const data = body.data;
    if (!data) throw new Error("Missing sale metrics payload");
    return data;
  } catch (err) {
    console.error("[getAdminSaleDetailMetrics] Failed to load sale metrics:", err);
    return EMPTY_ADMIN_SALE_DETAIL_METRICS;
  }
}
