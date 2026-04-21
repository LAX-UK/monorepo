import "server-only";

import type { ListLotsParams } from "@/lib/data/contracts";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { buildLotListQuery } from "@/lib/data/http/lots.server";
import { parseLot, parseSale } from "@/lib/data/http/parse";
import type { Lot, Sale } from "@auction/types";
import type { PaymentStatus } from "@auction/types";

export type AdminPaymentRow = {
  id: string;
  lotId: string;
  buyerId: string;
  sellerId: string;
  amount: string;
  platformFee: string;
  status: PaymentStatus;
  createdAt: Date;
};

function isPaymentStatus(s: string): s is PaymentStatus {
  return s === "pending" || s === "authorized" || s === "captured" || s === "refunded";
}

function parseAdminPaymentRow(raw: unknown): AdminPaymentRow {
  const o = raw as Record<string, unknown>;
  const status = typeof o.status === "string" && isPaymentStatus(o.status) ? o.status : "pending";
  const lotId = o.lotId != null ? String(o.lotId) : String(o.auctionId ?? "");
  return {
    id: String(o.id ?? ""),
    lotId,
    buyerId: String(o.buyerId ?? ""),
    sellerId: String(o.sellerId ?? ""),
    amount: String(o.amount ?? "0"),
    platformFee: String(o.platformFee ?? "0"),
    status,
    createdAt: o.createdAt instanceof Date ? o.createdAt : new Date(String(o.createdAt ?? "")),
  };
}

export async function getAdminLotList(params: ListLotsParams = {}): Promise<Lot[]> {
  const qs = new URLSearchParams(
    buildLotListQuery({ limit: params.limit ?? 100, offset: params.offset ?? 0, ...params }),
  );
  const res = await authedServerFetch(`/lots?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load lots: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseLot);
}

export type AdminSaleListRow = { sale: Sale; lots: Lot[] };

export async function getAdminSalesList(
  params: {
    status?: Sale["status"];
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminSaleListRow[]> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  const res = await authedServerFetch(`/sales?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load sales: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] }[] };
  return body.data.map((row) => ({
    sale: parseSale(row.sale),
    lots: row.lots.map(parseLot),
  }));
}

export async function getAdminSaleById(id: string): Promise<AdminSaleListRow | null> {
  const res = await authedServerFetch(`/sales/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load sale: ${res.status}`);
  const body = (await res.json()) as { data: { sale: unknown; lots: unknown[] } };
  return {
    sale: parseSale(body.data.sale),
    lots: body.data.lots.map(parseLot),
  };
}

export async function getAdminLotById(id: string): Promise<Lot | null> {
  const res = await authedServerFetch(`/lots/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to load lot: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown };
  return parseLot(body.data);
}

export async function getAdminPaymentList(): Promise<AdminPaymentRow[]> {
  const res = await authedServerFetch("/payments");
  if (!res.ok) {
    throw new Error(`Failed to load payments: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAdminPaymentRow);
}

export type AdminAnalyticsPayload = {
  activeLots: number;
  lotCompletedSeries: { date: string; count: number }[];
  conversion: { ended: number; withWinner: number };
  revenueSeries: { date: string; total: string }[];
  averageOrderValue: string | null;
  registrationSeries: { date: string; count: number }[];
  totalUsers: number;
  sparklines?: {
    revenue: readonly number[];
    lotCompleted: readonly number[];
    registrations: readonly number[];
  };
};

export type AdminTodayMetricsPayload = {
  liveLots: number;
  endingWithinHour: number;
  draftLots: number;
  pendingSubmissions: number;
  stalePendingPayments: number;
  revenueToday: string;
};

export async function getAdminMetricsToday(): Promise<AdminTodayMetricsPayload> {
  const res = await authedServerFetch("/admin/metrics/today");
  if (!res.ok) throw new Error(`Failed to load admin metrics: ${res.status}`);
  const body = (await res.json()) as { data: AdminTodayMetricsPayload };
  return body.data;
}

export async function getAdminMetricsLive(): Promise<{ bidsPerMinute: number }> {
  const res = await authedServerFetch("/admin/metrics/live");
  if (!res.ok) throw new Error(`Failed to load live metrics: ${res.status}`);
  const body = (await res.json()) as { data: { bidsPerMinute: number } };
  return body.data;
}

export async function getAdminAnalytics(days = 30): Promise<AdminAnalyticsPayload> {
  const res = await authedServerFetch(`/admin/analytics?days=${encodeURIComponent(String(days))}`);
  if (!res.ok) {
    throw new Error(`Failed to load analytics: ${res.status}`);
  }
  const body = (await res.json()) as { data: AdminAnalyticsPayload };
  return body.data;
}

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  suspendedAt: string | null;
};

export async function getAdminUserList(params: {
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ rows: AdminUserRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  const res = await authedServerFetch(`/admin/users?${qs.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load users: ${res.status}`);
  }
  const json = (await res.json()) as { data: { rows: AdminUserRow[]; total: number } };
  return json.data;
}

export type AdminUserDetailPayload = AdminUserRow & { suspendedReason: string | null };

export async function getAdminUserById(id: string): Promise<AdminUserDetailPayload | null> {
  const res = await authedServerFetch(`/admin/users/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load user: ${res.status}`);
  const body = (await res.json()) as { data: AdminUserDetailPayload };
  return body.data;
}
