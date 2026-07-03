import "server-only";

import {
  adminAnalyticsPayloadSchema,
  adminAttentionFeedSchema,
  adminFinanceIssuesPayloadSchema,
  adminLiveMetricsSchema,
  adminManualReviewPaymentsSchema,
  adminOnboardingIssuesPayloadSchema,
  adminTodayMetricsPayloadSchema,
} from "@/lib/data/http/admin-ops-dashboard.schema";
import type {
  AdminAnalyticsPayload,
  AdminAttentionFeedItem,
  AdminFinanceIssuesPayload,
  AdminManualReviewPaymentRow,
  AdminOnboardingIssuesPayload,
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

export async function getAdminOnboardingIssues(): Promise<AdminOnboardingIssuesPayload> {
  const res = await authedServerFetch("/admin/onboarding-issues");
  if (!res.ok) throw new Error(`Failed to load onboarding issues: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminOnboardingIssuesPayloadSchema, "GET /admin/onboarding-issues");
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

export async function getAdminAnalytics(days = 30): Promise<AdminAnalyticsPayload> {
  const res = await authedServerFetch(`/admin/analytics?days=${encodeURIComponent(String(days))}`);
  if (!res.ok) {
    throw new Error(`Failed to load analytics: ${res.status}`);
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, adminAnalyticsPayloadSchema, "GET /admin/analytics");
}
