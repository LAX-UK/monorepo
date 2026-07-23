import { isIndexableObject } from "@/lib/data/http/object-guards";
import { z } from "zod";

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

export type AdminLotFulfilmentListSummary = {
  total: number;
  awaitingPickup: number;
  inTransit: number;
  statusCounts: Record<string, number>;
};

export type AdminLotFulfilmentPageParams = {
  limit: number;
  offset: number;
  status?: string;
  q?: string;
};

export type AdminLotFulfilmentPage = {
  rows: AdminLotFulfilmentListRow[];
  total: number;
  offset: number;
  limit: number;
  summary: AdminLotFulfilmentListSummary;
  hasNextPage: boolean;
};

export const EMPTY_ADMIN_LOT_FULFILMENT_LIST_SUMMARY: AdminLotFulfilmentListSummary = {
  total: 0,
  awaitingPickup: 0,
  inTransit: 0,
  statusCounts: {},
};

const rowSchema = z.object({
  id: z.coerce.string(),
  lotId: z.coerce.string(),
  lotTitle: z.union([z.null(), z.coerce.string()]),
  status: z.coerce.string(),
  paymentId: z.union([z.null(), z.coerce.string()]),
  fulfilmentMethod: z.union([z.null(), z.coerce.string()]),
  shippingCarrier: z.union([z.null(), z.coerce.string()]),
  trackingNumber: z.union([z.null(), z.coerce.string()]),
});

const summarySchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  awaitingPickup: z.coerce.number().int().nonnegative(),
  inTransit: z.coerce.number().int().nonnegative(),
  statusCounts: z.record(z.coerce.string(), z.coerce.number().int().nonnegative()),
});

function parseSummary(value: unknown): AdminLotFulfilmentListSummary {
  const parsed = summarySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid lot fulfilment list summary in API response");
  }
  return parsed.data;
}

export function buildAdminLotFulfilmentSearchParams(
  params: AdminLotFulfilmentPageParams,
): URLSearchParams {
  const qs = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  return qs;
}

export function parseAdminLotFulfilmentPageBody(
  body: unknown,
  params: AdminLotFulfilmentPageParams,
): AdminLotFulfilmentPage {
  const envelope = isIndexableObject(body) ? body : {};
  const rows = Array.isArray(envelope.data) ? envelope.data.map((row) => rowSchema.parse(row)) : [];
  const meta = isIndexableObject(envelope.meta) ? envelope.meta : {};
  const summary = parseSummary(meta.summary);
  const total = Number(meta.total);
  if (!Number.isFinite(total)) {
    throw new Error("Invalid lot fulfilment list total in API response");
  }
  const limit = Number(meta.limit ?? params.limit);
  const offset = Number(meta.offset ?? params.offset);
  return {
    rows,
    total,
    offset,
    limit,
    summary,
    hasNextPage: offset + rows.length < total,
  };
}
