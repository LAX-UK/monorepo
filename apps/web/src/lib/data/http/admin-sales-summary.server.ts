import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminSalesLensCounts = {
  all: number;
  upcoming: number;
  live: number;
  closed: number;
  settled: number;
  setup: number;
};

export type AdminSalesListSummary = {
  activeCount: number;
  upcomingCount: number;
  draftCount: number;
  completedCount: number;
  avgLotsPerSale: number;
  totalHammerValue: string;
  lensCounts: AdminSalesLensCounts;
};

export const EMPTY_ADMIN_SALES_LIST_SUMMARY: AdminSalesListSummary = {
  activeCount: 0,
  upcomingCount: 0,
  draftCount: 0,
  completedCount: 0,
  avgLotsPerSale: 0,
  totalHammerValue: "0",
  lensCounts: {
    all: 0,
    upcoming: 0,
    live: 0,
    closed: 0,
    settled: 0,
    setup: 0,
  },
};

export async function getAdminSalesListSummary(): Promise<AdminSalesListSummary> {
  try {
    const res = await authedServerFetch("/admin/kpi/sales-summary");
    if (!res.ok) throw new Error(`Failed to load sales summary: ${res.status}`);
    const body = (await res.json()) as { data?: AdminSalesListSummary };
    const data = body.data;
    if (!data) throw new Error("Missing sales summary payload");
    return data;
  } catch (err) {
    console.error("[getAdminSalesListSummary] Failed to load sales summary:", err);
    return EMPTY_ADMIN_SALES_LIST_SUMMARY;
  }
}
