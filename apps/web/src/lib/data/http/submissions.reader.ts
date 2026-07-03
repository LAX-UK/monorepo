import "server-only";

import {
  authedServerFetch,
  authedServerFetchWithEntityFallback,
} from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody, readListEnvelope } from "@/lib/data/http/envelope";
import { itemSubmissionSchema } from "@/lib/data/http/submissions.schema";
import type {
  GetAdminSubmissionsParams,
  GetMySubmissionsParams,
} from "@/lib/data/http/submissions.types";
import {
  SubmissionsAccessError,
  parseSubmissionsAccessFailure,
} from "@/lib/legal-entity/submissions-access-errors";
import type { ItemSubmission, ItemSubmissionStatus } from "@auction/types";
import { cache } from "react";
import { z } from "zod";

export type { AdminSubmissionDecisionQueue } from "@/lib/data/http/submissions.types";

const submissionSummarySchema = z.object({
  counts: z.record(z.coerce.number()),
  total: z.coerce.number(),
}) as z.ZodType<{ counts: Record<ItemSubmissionStatus, number>; total: number }>;

const countSchema = z.object({ count: z.number() });

export async function getMySubmissions(
  params: GetMySubmissionsParams = {},
): Promise<{ rows: ItemSubmission[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  if (params.status) qs.set("status", params.status);
  if (params.q?.trim()) qs.set("q", params.q.trim());

  const res = await authedServerFetchWithEntityFallback(`/submissions/mine?${qs.toString()}`);
  if (!res.ok) {
    throw new SubmissionsAccessError(await parseSubmissionsAccessFailure(res));
  }

  const body = await readJsonBody(res);
  return readListEnvelope(body, itemSubmissionSchema, "GET /submissions/mine");
}

export async function getMySubmissionSummary(): Promise<{
  counts: Record<ItemSubmissionStatus, number>;
  total: number;
}> {
  const res = await authedServerFetchWithEntityFallback("/submissions/mine/summary");
  if (!res.ok) {
    throw new SubmissionsAccessError(await parseSubmissionsAccessFailure(res));
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, submissionSummarySchema, "GET /submissions/mine/summary");
}

export async function getSubmissionForUser(id: string): Promise<ItemSubmission | null> {
  const res = await authedServerFetchWithEntityFallback(`/submissions/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new SubmissionsAccessError(await parseSubmissionsAccessFailure(res));
  }
  const body = await readJsonBody(res);
  return readDataEnvelope(body, itemSubmissionSchema, `GET /submissions/${id}`);
}

export async function getAdminSubmissions(
  params: GetAdminSubmissionsParams = {},
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
  const body = await readJsonBody(res);
  return readListEnvelope(body, itemSubmissionSchema, "GET /submissions");
}

export const getAdminSubmissionById = cache(async (id: string): Promise<ItemSubmission | null> => {
  const res = await authedServerFetch(`/submissions/${encodeURIComponent(id)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load submission: ${res.status}`);
  const body = await readJsonBody(res);
  return readDataEnvelope(body, itemSubmissionSchema, `GET /submissions/${id}`);
});

export async function getAdminSubmissionPendingCount(): Promise<number> {
  const res = await authedServerFetch("/admin/submissions/pending-count?status=submitted");
  if (!res.ok) return 0;
  const body = await readJsonBody(res);
  return readDataEnvelope(body, countSchema, "GET /admin/submissions/pending-count").count;
}

/** Total submissions across seller legal entities in one request. */
export async function getAdminSubmissionCountBySellers(
  sellerIds: readonly string[],
): Promise<number> {
  if (sellerIds.length === 0) return 0;
  const qs = new URLSearchParams({ sellerIds: sellerIds.join(",") });
  const res = await authedServerFetch(`/admin/submissions/count-by-sellers?${qs.toString()}`);
  if (!res.ok) return 0;
  const body = await readJsonBody(res);
  const parsed = readDataEnvelope(body, countSchema, "GET /admin/submissions/count-by-sellers");
  return Number(parsed.count ?? 0);
}
