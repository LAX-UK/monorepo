import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminLotDetailMetrics = {
  currentHammer: string | null;
  startingPrice: string | null;
  estimateLow: string | null;
  estimateHigh: string | null;
  reservePrice: string | null;
  bidCount: number;
  uniqueBidders: number;
  reserveMet: boolean | null;
  buyerPremiumLabel: string | null;
  pageViewCount: number | null;
};

export const EMPTY_ADMIN_LOT_DETAIL_METRICS: AdminLotDetailMetrics = {
  currentHammer: null,
  startingPrice: null,
  estimateLow: null,
  estimateHigh: null,
  reservePrice: null,
  bidCount: 0,
  uniqueBidders: 0,
  reserveMet: null,
  buyerPremiumLabel: null,
  pageViewCount: null,
};

export async function getAdminLotDetailMetrics(lotId: string): Promise<AdminLotDetailMetrics> {
  try {
    const res = await authedServerFetch(`/admin/lots/${encodeURIComponent(lotId)}/metrics`);
    if (!res.ok) throw new Error(`Failed to load lot metrics: ${res.status}`);
    const body = (await res.json()) as { data?: AdminLotDetailMetrics };
    const data = body.data;
    if (!data) throw new Error("Missing lot metrics payload");
    return data;
  } catch (err) {
    console.error("[getAdminLotDetailMetrics] Failed to load lot metrics:", err);
    return EMPTY_ADMIN_LOT_DETAIL_METRICS;
  }
}
