import "server-only";

import type { ConditionReportRequestSnapshot } from "@/lib/condition-report/condition-report-types";
import type { BuyerConditionReportRequestRowDto } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { cache } from "react";

function parseRequestRow(raw: unknown): ConditionReportRequestSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const status = o.status;
  if (
    status !== "pending" &&
    status !== "in_progress" &&
    status !== "fulfilled" &&
    status !== "declined"
  ) {
    return null;
  }
  if (typeof o.id !== "string" || typeof o.lotId !== "string") return null;
  const createdAt =
    typeof o.createdAt === "string"
      ? o.createdAt
      : o.createdAt instanceof Date
        ? o.createdAt.toISOString()
        : new Date().toISOString();
  return {
    id: o.id,
    lotId: o.lotId,
    status: status as ConditionReportRequestSnapshot["status"],
    requestNote: typeof o.requestNote === "string" ? o.requestNote : null,
    responseNote: typeof o.responseNote === "string" ? o.responseNote : null,
    createdAt,
  };
}

export const getServerConditionReportForLot = cache(
  async (lotId: string): Promise<ConditionReportRequestSnapshot | null> => {
    const res = await authedServerFetch(
      `/lots/${encodeURIComponent(lotId)}/condition-report-request`,
      { cache: "no-store" },
    );
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: unknown };
    return parseRequestRow(body.data ?? null);
  },
);

export async function getServerMyConditionReportRequests(
  limit = 50,
  offset = 0,
): Promise<{ items: BuyerConditionReportRequestRowDto[]; total: number }> {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await authedServerFetch(`/users/me/condition-report-requests?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load condition report requests: ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: { items?: unknown[]; total?: number };
  };
  const items = (body.data?.items ?? [])
    .map((raw) => {
      const base = parseRequestRow(raw);
      if (!base) return null;
      const o = raw as Record<string, unknown>;
      return {
        ...base,
        lotTitle: typeof o.lotTitle === "string" ? o.lotTitle : "Lot",
        lotNumber: typeof o.lotNumber === "number" ? o.lotNumber : null,
        downloadUrl: typeof o.downloadUrl === "string" ? o.downloadUrl : null,
        fulfilledAt:
          typeof o.fulfilledAt === "string"
            ? o.fulfilledAt
            : o.fulfilledAt instanceof Date
              ? o.fulfilledAt.toISOString()
              : null,
      } satisfies BuyerConditionReportRequestRowDto;
    })
    .filter((r): r is BuyerConditionReportRequestRowDto => r != null);
  return { items, total: Number(body.data?.total ?? items.length) };
}
