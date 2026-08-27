import "server-only";

import type { ConditionReportRequestSnapshot } from "@/lib/condition-report/condition-report-types";
import type { BuyerConditionReportRequestRowDto } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { parseConditionReportRequestRow } from "@/lib/condition-report/parse-condition-report-request-row";
import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { cache } from "react";

export const getServerConditionReportForLot = cache(
  async (lotId: string): Promise<ConditionReportRequestSnapshot | null> => {
    const res = await authedServerFetch(
      `/lots/${encodeURIComponent(lotId)}/condition-report-request`,
      { cache: "no-store" },
    );
    if (res.status === 401 || res.status === 403 || res.status === 404) return null;
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: unknown };
    return parseConditionReportRequestRow(body.data ?? null);
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
      const base = parseConditionReportRequestRow(raw);
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
