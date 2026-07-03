import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

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
