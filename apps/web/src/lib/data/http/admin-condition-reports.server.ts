import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminConditionReportRequestRow = {
  id: string;
  lotId: string;
  requestedByUserId: string;
  requestingLegalEntityId: string | null;
  status: "pending" | "in_progress" | "fulfilled" | "declined";
  requestNote: string | null;
  responseNote: string | null;
  responseAttachmentUploadId: string | null;
  fulfilledByUserId: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  lotTitle: string | null;
  requesterEmail: string | null;
};

const crStatuses = ["pending", "in_progress", "fulfilled", "declined"] as const;

function parseAdminConditionReportRequestRow(raw: unknown): AdminConditionReportRequestRow {
  const o = raw as Record<string, unknown>;
  const st = o.status;
  const status =
    typeof st === "string" && (crStatuses as readonly string[]).includes(st)
      ? (st as AdminConditionReportRequestRow["status"])
      : "pending";
  return {
    id: String(o.id ?? ""),
    lotId: String(o.lotId ?? ""),
    requestedByUserId: String(o.requestedByUserId ?? ""),
    requestingLegalEntityId:
      o.requestingLegalEntityId == null ? null : String(o.requestingLegalEntityId),
    status,
    requestNote: o.requestNote == null ? null : String(o.requestNote),
    responseNote: o.responseNote == null ? null : String(o.responseNote),
    responseAttachmentUploadId:
      o.responseAttachmentUploadId == null ? null : String(o.responseAttachmentUploadId),
    fulfilledByUserId: o.fulfilledByUserId == null ? null : String(o.fulfilledByUserId),
    fulfilledAt: o.fulfilledAt == null ? null : String(o.fulfilledAt),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : "",
    lotTitle: o.lotTitle == null ? null : String(o.lotTitle),
    requesterEmail: o.requesterEmail == null ? null : String(o.requesterEmail),
  };
}

export async function getAdminConditionReportRequests(params?: {
  status?: "open" | AdminConditionReportRequestRow["status"];
  lotId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  items: AdminConditionReportRequestRow[];
  total: number;
  limit: number;
  offset: number;
}> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.lotId) qs.set("lotId", params.lotId);
  qs.set("limit", String(params?.limit ?? 50));
  qs.set("offset", String(params?.offset ?? 0));
  const res = await authedServerFetch(`/admin/condition-report-requests?${qs.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to load condition report requests: ${res.status}`);
  const body = (await res.json()) as {
    data: { items: unknown[]; total: number; limit: number; offset: number };
  };
  return {
    items: body.data.items.map(parseAdminConditionReportRequestRow),
    total: body.data.total,
    limit: body.data.limit,
    offset: body.data.offset,
  };
}
