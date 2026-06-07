import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { parseItemSubmission } from "@/lib/data/http/parse";
import {
  SubmissionsAccessError,
  parseSubmissionsAccessFailure,
} from "@/lib/legal-entity/submissions-access-errors";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import { cache } from "react";

/** Admin submissions decision-queue tabs (`GET /submissions?queue=`). */
export type AdminSubmissionDecisionQueue = "awaiting" | "accepted" | "rejected";

export async function getMySubmissions(
  params: {
    status?: ItemSubmissionStatus;
    q?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ rows: ItemSubmission[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());

  let res = await authedServerFetch(`/submissions/mine?${qs.toString()}`);
  if (res.status === 403) {
    res = await authedServerFetch(`/submissions/mine?${qs.toString()}`, {
      skipActingLegalEntityHeader: true,
    });
  }
  if (!res.ok) {
    throw new SubmissionsAccessError(await parseSubmissionsAccessFailure(res));
  }

  const body = (await res.json()) as { data: unknown[]; total?: number };
  return {
    rows: body.data.map(parseItemSubmission),
    total: Number(body.total ?? body.data.length),
  };
}

export async function getMySubmissionSummary(): Promise<{
  counts: Record<ItemSubmissionStatus, number>;
  total: number;
}> {
  let res = await authedServerFetch("/submissions/mine/summary");
  if (res.status === 403) {
    res = await authedServerFetch("/submissions/mine/summary", {
      skipActingLegalEntityHeader: true,
    });
  }
  if (!res.ok) {
    throw new SubmissionsAccessError(await parseSubmissionsAccessFailure(res));
  }
  const body = (await res.json()) as {
    data: { counts: Record<ItemSubmissionStatus, number>; total: number };
  };
  return body.data;
}

export async function getSubmissionForUser(id: string): Promise<ItemSubmission | null> {
  let res = await authedServerFetch(`/submissions/${encodeURIComponent(id)}`);
  if (res.status === 403) {
    res = await authedServerFetch(`/submissions/${encodeURIComponent(id)}`, {
      skipActingLegalEntityHeader: true,
    });
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new SubmissionsAccessError(await parseSubmissionsAccessFailure(res));
  }
  const body = (await res.json()) as { data: unknown };
  return parseItemSubmission(body.data);
}

export async function getAdminSubmissions(
  params: {
    status?: ItemSubmissionStatus;
    /** Grouped statuses for staff queues. Prefer over `status` when both passed. */
    queue?: AdminSubmissionDecisionQueue;
    sellerId?: string;
    categoryId?: string;
    q?: string;
    qualityGaps?: boolean;
    assignedTo?: "me";
    sort?: "newest" | "oldest" | "sla";
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ rows: ItemSubmission[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  if (params.queue) qs.set("queue", params.queue);
  else if (params.status) qs.set("status", params.status);
  if (params.sellerId) qs.set("sellerId", params.sellerId);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.q?.trim()) qs.set("q", params.q.trim());
  if (params.qualityGaps) qs.set("qualityGaps", "1");
  if (params.assignedTo === "me") qs.set("assignedTo", "me");
  if (params.sort) qs.set("sort", params.sort);
  const res = await authedServerFetch(`/submissions?${qs.toString()}`);
  if (!res.ok) throw new Error(`Failed to load admin submissions: ${res.status}`);
  const body = (await res.json()) as { data: unknown[]; total?: number };
  return {
    rows: body.data.map(parseItemSubmission),
    total: Number(body.total ?? body.data.length),
  };
}

export const getAdminSubmissionById = cache(async (id: string): Promise<ItemSubmission | null> => {
  const res = await authedServerFetch(`/submissions/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load submission: ${res.status}`);
  const body = (await res.json()) as { data: unknown };
  return parseItemSubmission(body.data);
});

export async function getAdminSubmissionPendingCount(): Promise<number> {
  const res = await authedServerFetch("/admin/submissions/pending-count?status=submitted");
  if (!res.ok) return 0;
  const body = (await res.json()) as { data: { count: number } };
  return body.data.count;
}

/** Total submissions across seller legal entities in one request. */
export async function getAdminSubmissionCountBySellers(
  sellerIds: readonly string[],
): Promise<number> {
  if (sellerIds.length === 0) return 0;
  const qs = new URLSearchParams({ sellerIds: sellerIds.join(",") });
  const res = await authedServerFetch(`/admin/submissions/count-by-sellers?${qs.toString()}`);
  if (!res.ok) return 0;
  const body = (await res.json()) as { data: { count: number } };
  return Number(body.data.count ?? 0);
}
