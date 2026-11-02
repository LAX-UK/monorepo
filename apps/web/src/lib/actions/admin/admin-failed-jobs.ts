"use server";

import { type FailedJobOutcome, summariseBatch } from "@/lib/admin/failed-jobs/failed-job-outcome";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { failedJobBatchResultSchema } from "@/lib/data/http/admin-failed-jobs.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/forms/form-result";
import { FAILED_JOBS_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import {
  adminFailedJobsDiscardBodySchema,
  adminFailedJobsRestoreBodySchema,
  adminFailedJobsRetryBodySchema,
} from "@auction/validators";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

const LIST_PATH = "/admin/failed-jobs";

/**
 * Sends one decision about failed jobs to the API and reports what happened to each job. The
 * request fails as a whole only when the API refuses it; a job it refuses on its own (already
 * retried, a type that can't be retried) is part of the outcome, so the dialog can say which.
 */
async function decide(
  name: string,
  action: "retry" | "discard" | "restore",
  body: unknown,
  schema: z.ZodType,
  fallback: string,
): Promise<ActionResult<FailedJobOutcome>> {
  return instrumentServerAction(name, async () => {
    const denied = await denyUnlessAdminCapability(FAILED_JOBS_WRITE_ACCESS);
    if (denied) return denied;
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return actionFailure(parsed.error.issues[0]?.message ?? fallback, undefined, 400);
    }
    const res = await authedServerFetch(`/admin/system/failed-jobs/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    if (!res.ok) return actionFailure(fallback, undefined, res.status);
    const result = readDataEnvelope(
      await readJsonBody(res),
      failedJobBatchResultSchema,
      `POST /admin/system/failed-jobs/${action}`,
    );
    revalidatePath(LIST_PATH);
    for (const outcome of result.results) {
      if (outcome.ok) revalidatePath(`${LIST_PATH}/${encodeURIComponent(outcome.id)}`);
    }
    return actionSuccess(summariseBatch(result));
  });
}

export async function retryFailedJobsAction(input: {
  ids: string[];
  confirmRepeat: boolean;
}): Promise<ActionResult<FailedJobOutcome>> {
  return decide(
    "retryFailedJobsAction",
    "retry",
    input,
    adminFailedJobsRetryBodySchema,
    "The retry did not go through. Try again in a moment.",
  );
}

export async function discardFailedJobsAction(input: {
  ids: string[];
  reason: string;
  note?: string;
}): Promise<ActionResult<FailedJobOutcome>> {
  return decide(
    "discardFailedJobsAction",
    "discard",
    input,
    adminFailedJobsDiscardBodySchema,
    "The discard did not go through. Try again in a moment.",
  );
}

export async function restoreFailedJobsAction(input: {
  ids: string[];
}): Promise<ActionResult<FailedJobOutcome>> {
  return decide(
    "restoreFailedJobsAction",
    "restore",
    input,
    adminFailedJobsRestoreBodySchema,
    "The restore did not go through. Try again in a moment.",
  );
}
