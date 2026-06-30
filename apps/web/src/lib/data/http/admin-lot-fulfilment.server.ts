import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { ItemSubmissionStatus, LotStatus } from "@auction/types";
import { itemSubmissionStatuses, lotStatuses } from "@auction/types";

export type AdminLotFulfilmentListRow = {
  id: string;
  lotId: string;
  lotTitle: string | null;
  status: string;
  paymentId: string | null;
  fulfilmentMethod: string | null;
  shippingCarrier: string | null;
  trackingNumber: string | null;
};

function parseAdminLotFulfilmentListRow(raw: unknown): AdminLotFulfilmentListRow {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id ?? ""),
    lotId: String(o.lotId ?? ""),
    lotTitle: o.lotTitle == null ? null : String(o.lotTitle),
    status: String(o.status ?? ""),
    paymentId: o.paymentId == null ? null : String(o.paymentId),
    fulfilmentMethod: o.fulfilmentMethod == null ? null : String(o.fulfilmentMethod),
    shippingCarrier: o.shippingCarrier == null ? null : String(o.shippingCarrier),
    trackingNumber: o.trackingNumber == null ? null : String(o.trackingNumber),
  };
}

async function fetchAdminLotFulfilmentListResponse(params?: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<
  | {
      kind: "ok";
      rows: AdminLotFulfilmentListRow[];
      total: number;
      statusCounts: Record<string, number>;
    }
  | { kind: "authz" }
  | { kind: "error"; message: string }
> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  if (params?.limit != null) qs.set("limit", String(params.limit));
  if (params?.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(`/admin/lot-fulfilment${suffix}`, { cache: "no-store" });
  if (res.status === 403 || res.status === 401) return { kind: "authz" };
  if (!res.ok) {
    return { kind: "error", message: `Failed to load lot fulfilment: ${res.status}` };
  }
  const body = (await res.json()) as {
    data: unknown[];
    meta?: { total?: number; statusCounts?: Record<string, number> };
  };
  return {
    kind: "ok",
    rows: body.data.map(parseAdminLotFulfilmentListRow),
    total: body.meta?.total ?? body.data.length,
    statusCounts: body.meta?.statusCounts ?? {},
  };
}

/** Operations fulfilment capability; returns empty when the user cannot access the queue. */
export async function getAdminLotFulfilmentList(params?: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminLotFulfilmentListRow[]> {
  const r = await fetchAdminLotFulfilmentListResponse(params);
  if (r.kind === "authz") return [];
  if (r.kind === "error") throw new Error(r.message);
  return r.rows;
}

export type LotFulfilmentQueueLoadResult =
  | {
      access: "ok";
      rows: AdminLotFulfilmentListRow[];
      total: number;
      statusCounts: Record<string, number>;
    }
  | { access: "forbidden" }
  | { access: "error"; message: string };

/** Same list as {@link getAdminLotFulfilmentList}, but distinguishes 403 from an empty queue. */
export async function loadAdminLotFulfilmentQueue(params?: {
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<LotFulfilmentQueueLoadResult> {
  const r = await fetchAdminLotFulfilmentListResponse(params);
  if (r.kind === "authz") return { access: "forbidden" };
  if (r.kind === "error") return { access: "error", message: r.message };
  return { access: "ok", rows: r.rows, total: r.total, statusCounts: r.statusCounts };
}

export type AdminConveyorPipelineRow = {
  submissionId: string;
  title: string;
  submissionStatus: ItemSubmissionStatus;
  convertedLotId: string | null;
  lotId: string | null;
  lotStatus: LotStatus | null;
  lotTitle: string | null;
  artistReviewRequired: boolean | null;
  archivedSeller: boolean | null;
  assignedToUserId: string | null;
  updatedAt: string;
};

function parseAdminConveyorPipelineRow(raw: unknown): AdminConveyorPipelineRow {
  const o = raw as Record<string, unknown>;
  const subSt = String(o.submissionStatus ?? "");
  const submissionStatus: ItemSubmissionStatus = (
    itemSubmissionStatuses as readonly string[]
  ).includes(subSt)
    ? (subSt as ItemSubmissionStatus)
    : "draft";
  const rawLotSt = o.lotStatus == null ? null : String(o.lotStatus);
  const lotStatus: LotStatus | null =
    rawLotSt === null
      ? null
      : (lotStatuses as readonly string[]).includes(rawLotSt)
        ? (rawLotSt as LotStatus)
        : null;
  return {
    submissionId: String(o.submissionId ?? ""),
    title: String(o.title ?? ""),
    submissionStatus,
    convertedLotId: o.convertedLotId == null ? null : String(o.convertedLotId),
    lotId: o.lotId == null ? null : String(o.lotId),
    lotStatus,
    lotTitle: o.lotTitle == null ? null : String(o.lotTitle),
    artistReviewRequired:
      typeof o.artistReviewRequired === "boolean" ? o.artistReviewRequired : null,
    archivedSeller: typeof o.archivedSeller === "boolean" ? o.archivedSeller : null,
    assignedToUserId: o.assignedToUserId == null ? null : String(o.assignedToUserId),
    updatedAt: String(o.updatedAt ?? ""),
  };
}

export async function getAdminConveyorPipeline(params?: {
  limit?: number;
}): Promise<AdminConveyorPipelineRow[]> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set("limit", String(params.limit));
  const suffix = qs.size ? `?${qs.toString()}` : "";
  const res = await authedServerFetch(`/admin/conveyor-pipeline${suffix}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load conveyor pipeline: ${res.status}`);
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminConveyorPipelineRow);
}
