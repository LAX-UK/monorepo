import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminLotsLensCounts = {
  all: number;
  live: number;
  draft: number;
  ending: number;
  attention: number;
};

export type AdminLotsListSummary = {
  liveCount: number;
  draftCount: number;
  endingSoonCount: number;
  needsAttentionCount: number;
  endedCount: number;
  publishedCount: number;
  totalHammerValue: string;
  lensCounts: AdminLotsLensCounts;
};

export const EMPTY_ADMIN_LOTS_LIST_SUMMARY: AdminLotsListSummary = {
  liveCount: 0,
  draftCount: 0,
  endingSoonCount: 0,
  needsAttentionCount: 0,
  endedCount: 0,
  publishedCount: 0,
  totalHammerValue: "0",
  lensCounts: {
    all: 0,
    live: 0,
    draft: 0,
    ending: 0,
    attention: 0,
  },
};

export async function getAdminLotsListSummary(): Promise<AdminLotsListSummary> {
  try {
    const res = await authedServerFetch("/admin/kpi/lots-summary");
    if (!res.ok) throw new Error(`Failed to load lots summary: ${res.status}`);
    const body = (await res.json()) as { data?: AdminLotsListSummary };
    const data = body.data;
    if (!data) throw new Error("Missing lots summary payload");
    return data;
  } catch (err) {
    console.error("[getAdminLotsListSummary] Failed to load lots summary:", err);
    return EMPTY_ADMIN_LOTS_LIST_SUMMARY;
  }
}
