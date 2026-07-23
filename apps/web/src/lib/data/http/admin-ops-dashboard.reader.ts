import "server-only";

import {
  adminAttentionFeedSchema,
  adminFinanceIssuesPayloadSchema,
  adminLiveMetricsSchema,
  adminManualReviewPaymentsSchema,
  adminTodayMetricsPayloadSchema,
} from "@/lib/data/http/admin-ops-dashboard.schema";
import type {
  AdminAttentionFeedItem,
  AdminFinanceIssuesPayload,
  AdminManualReviewPaymentRow,
  AdminTodayMetricsPayload,
} from "@/lib/data/http/admin-ops-dashboard.types";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";

export async function getAdminFinanceIssues(): Promise<AdminFinanceIssuesPayload> {
  const res = await authedServerFetch("/admin/metrics/finance-issues");
  if (!res.ok) throw new Error(`Failed to load finance issue metrics: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminFinanceIssuesPayloadSchema,
    "GET /admin/metrics/finance-issues",
  );
}

export async function getAdminManualReviewPayments(): Promise<AdminManualReviewPaymentRow[]> {
  const res = await authedServerFetch("/admin/payments/manual-review");
  if (!res.ok) throw new Error(`Failed to load manual review payments: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(
    body,
    adminManualReviewPaymentsSchema,
    "GET /admin/payments/manual-review",
  );
}

export async function getAdminMetricsToday(): Promise<AdminTodayMetricsPayload> {
  const res = await authedServerFetch("/admin/metrics/today");
  if (!res.ok) throw new Error(`Failed to load admin metrics: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminTodayMetricsPayloadSchema, "GET /admin/metrics/today");
}

export async function getAdminMetricsLive(): Promise<{ bidsPerMinute: number }> {
  const res = await authedServerFetch("/admin/metrics/live");
  if (!res.ok) throw new Error(`Failed to load live metrics: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminLiveMetricsSchema, "GET /admin/metrics/live");
}

export async function getAdminAttentionFeed(): Promise<AdminAttentionFeedItem[]> {
  const res = await authedServerFetch("/admin/attention");
  if (!res.ok) throw new Error(`Failed to load attention feed: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminAttentionFeedSchema, "GET /admin/attention");
}
