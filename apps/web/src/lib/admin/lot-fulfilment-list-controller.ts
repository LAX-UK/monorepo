import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminLotFulfilmentListRow } from "@/lib/data/http/admin.server";
import { loadAdminLotFulfilmentQueue } from "@/lib/data/http/admin.server";
import {
  type LotFulfilmentKpiSummary,
  buildLotFulfilmentTableRows,
  summarizeLotFulfilmentKpis,
} from "@/lib/data/view-models/admin-lot-fulfilment.vm";

const FILTER_STATUSES = [
  "awaiting_payment",
  "awaiting_release",
  "released",
  "ready_for_collection",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

function parseStatusFilter(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return (FILTER_STATUSES as readonly string[]).includes(raw) ? raw : undefined;
}

export type LotFulfilmentListQuery = {
  limit: number;
  offset: number;
  q?: string | undefined;
  status?: string | undefined;
  error?: string | undefined;
};

export type LotFulfilmentListResult =
  | {
      access: "ok";
      rows: AdminLotFulfilmentListRow[];
      total: number;
      statusCounts: Record<string, number>;
      summary: LotFulfilmentKpiSummary;
      offset: number;
      limit: number;
      statusFilter?: string | undefined;
      q: string;
    }
  | { access: "forbidden" }
  | { access: "error"; message: string };

export const lotFulfilmentListController = {
  id: "lot-fulfilment",
  parseQuery(searchParams: Record<string, string | string[] | undefined>): LotFulfilmentListQuery {
    const base = parseListSearchParams(searchParams);
    const status = parseStatusFilter(firstString(searchParams.status));
    const error = firstString(searchParams.error);
    return {
      limit: Math.min(100, Math.max(1, base.limit)),
      offset: Math.max(0, base.offset),
      q: base.q?.trim() || undefined,
      status,
      error,
    };
  },
  async fetch(query: LotFulfilmentListQuery): Promise<LotFulfilmentListResult> {
    const loaded = await loadAdminLotFulfilmentQueue({
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.q ? { q: query.q } : {}),
      limit: query.limit,
      offset: query.offset,
    });

    if (loaded.access === "forbidden") return { access: "forbidden" };
    if (loaded.access === "error") return { access: "error", message: loaded.message };

    const rows = buildLotFulfilmentTableRows(loaded.rows);
    return {
      access: "ok",
      rows,
      total: loaded.total,
      statusCounts: loaded.statusCounts,
      summary: summarizeLotFulfilmentKpis(loaded.total, loaded.statusCounts),
      offset: query.offset,
      limit: query.limit,
      statusFilter: query.status,
      q: query.q ?? "",
    };
  },
};
