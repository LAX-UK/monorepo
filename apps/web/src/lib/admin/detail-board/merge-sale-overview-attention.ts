import { mapSaleAttentionToRows } from "@/lib/admin/detail-board/map-sale-attention";
import type { DetailAttentionRow } from "@/lib/admin/detail-board/types";
import type { AdminSaleAttention } from "@/lib/data/http/admin-sale-attention.server";

/** Deduplicated sale overview attention rows from API + local readiness/blockers. */
export function mergeSaleOverviewAttentionRows(
  saleId: string,
  sources: {
    fromReadiness: readonly DetailAttentionRow[];
    fromBlockers: readonly DetailAttentionRow[];
    fromPendingRegs: readonly DetailAttentionRow[];
    fromApi: AdminSaleAttention | null | undefined;
  },
): DetailAttentionRow[] {
  const apiRows = sources.fromApi != null ? mapSaleAttentionToRows(saleId, sources.fromApi) : [];

  const merged = [
    ...sources.fromBlockers,
    ...sources.fromReadiness,
    ...sources.fromPendingRegs,
    ...apiRows,
  ];

  const seen = new Set<string>();
  const rows: DetailAttentionRow[] = [];
  for (const row of merged) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}

export function countSaleOverviewAttentionRows(rows: readonly DetailAttentionRow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(1, row.count), 0);
}
