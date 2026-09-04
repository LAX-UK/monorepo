import type {
  ConditionReportRequestSnapshot,
  ConditionReportRequestStatus,
} from "@/lib/condition-report/condition-report-types";
import type { BuyerConditionReportRequestRowDto } from "@/lib/condition-report/map-buyer-condition-report-requests.vm";
import { parseConditionReportRequestRow } from "@/lib/condition-report/parse-condition-report-request-row";

function apiBase(): string {
  return "/api/bff";
}

function parseListRow(raw: unknown): BuyerConditionReportRequestRowDto | null {
  const base = parseConditionReportRequestRow(raw);
  if (!base) return null;
  const o = raw as Record<string, unknown>;
  const lotTitle = typeof o.lotTitle === "string" ? o.lotTitle : "Lot";
  const lotNumber = typeof o.lotNumber === "number" ? o.lotNumber : null;
  const downloadUrl = typeof o.downloadUrl === "string" ? o.downloadUrl : null;
  const fulfilledAt =
    o.fulfilledAt instanceof Date
      ? o.fulfilledAt.toISOString()
      : typeof o.fulfilledAt === "string"
        ? o.fulfilledAt
        : null;
  return {
    ...base,
    lotTitle,
    lotNumber,
    downloadUrl,
    fulfilledAt,
  };
}

export async function fetchMyConditionReportForLot(
  lotId: string,
): Promise<ConditionReportRequestSnapshot | null> {
  const res = await fetch(
    `${apiBase()}/lots/${encodeURIComponent(lotId)}/condition-report-request`,
    { credentials: "include", cache: "no-store" },
  );
  if (res.status === 401 || res.status === 403) return null;
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: unknown };
  return parseConditionReportRequestRow(body.data ?? null);
}

export async function submitConditionReportRequest(
  lotId: string,
  requestNote: string,
): Promise<{ ok: true; row: ConditionReportRequestSnapshot } | { ok: false; message: string }> {
  const res = await fetch(
    `${apiBase()}/lots/${encodeURIComponent(lotId)}/condition-report-requests`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestNote ? { requestNote } : {}),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    data?: unknown;
  };
  if (!res.ok) {
    const message =
      body.code === "condition_report_already_requested"
        ? "You have already requested a condition report for this lot"
        : (body.error ?? "Request failed");
    return { ok: false, message };
  }
  const row = parseConditionReportRequestRow(body.data);
  if (!row) {
    return { ok: false, message: "Unexpected response from server" };
  }
  return { ok: true, row };
}

export async function fetchMyConditionReportRequests(opts?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: BuyerConditionReportRequestRowDto[]; total: number }> {
  const qs = new URLSearchParams();
  if (opts?.limit != null) qs.set("limit", String(opts.limit));
  if (opts?.offset != null) qs.set("offset", String(opts.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await fetch(`${apiBase()}/users/me/condition-report-requests${suffix}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load condition report requests: ${res.status}`);
  }
  const body = (await res.json()) as {
    data?: { items?: unknown[]; total?: number };
  };
  const items = (body.data?.items ?? [])
    .map(parseListRow)
    .filter((r): r is BuyerConditionReportRequestRowDto => r != null);
  return { items, total: Number(body.data?.total ?? items.length) };
}

export type { ConditionReportRequestStatus };
