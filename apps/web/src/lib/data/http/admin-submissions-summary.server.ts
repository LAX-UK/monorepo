import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type AdminSubmissionsQueueCounts = {
  awaiting: number;
  accepted: number;
  rejected: number;
};

export type AdminSubmissionsListSummary = {
  awaitingReview: number;
  assignedToMe: number;
  overSla: number;
  rejectedToday: number;
  qualityGaps: number;
  reviewedToday: number;
  avgQueueAgeDays: number | null;
  queueCounts: AdminSubmissionsQueueCounts;
};

export const EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY: AdminSubmissionsListSummary = {
  awaitingReview: 0,
  assignedToMe: 0,
  overSla: 0,
  rejectedToday: 0,
  qualityGaps: 0,
  reviewedToday: 0,
  avgQueueAgeDays: null,
  queueCounts: {
    awaiting: 0,
    accepted: 0,
    rejected: 0,
  },
};

export async function getAdminSubmissionsListSummary(): Promise<AdminSubmissionsListSummary> {
  try {
    const res = await authedServerFetch("/admin/kpi/submissions-summary");
    if (!res.ok) throw new Error(`Failed to load submissions summary: ${res.status}`);
    const body = (await res.json()) as { data?: AdminSubmissionsListSummary };
    const data = body.data;
    if (!data) throw new Error("Missing submissions summary payload");
    return data;
  } catch (err) {
    console.error("[getAdminSubmissionsListSummary] Failed to load submissions summary:", err);
    return EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY;
  }
}
