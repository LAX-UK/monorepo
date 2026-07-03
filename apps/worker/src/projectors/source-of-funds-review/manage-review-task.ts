import { adminReviewTask } from "@auction/db";
import { and, eq, sql } from "drizzle-orm";
import type pino from "pino";
import type { Db } from "../lib/projector.types.js";
import type { SourceOfFundsRequiredPayload } from "./sof-review-helpers.js";

export async function manageSourceOfFundsReviewTask(args: {
  db: Db;
  log: pino.Logger;
  payload: SourceOfFundsRequiredPayload;
  sourceOfFundsId: string;
}): Promise<{ createdTask: boolean }> {
  const { db, log, payload, sourceOfFundsId } = args;

  const existing = await db
    .select({ id: adminReviewTask.id, status: adminReviewTask.status })
    .from(adminReviewTask)
    .where(
      and(
        eq(adminReviewTask.kind, "source_of_funds_review"),
        sql`${adminReviewTask.payload} ->> 'sourceOfFundsId' = ${sourceOfFundsId}`,
      ),
    )
    .limit(1);

  const reopened = Boolean(payload.reopened);
  const existingTask = existing[0];
  if (existingTask && reopened) {
    await db
      .update(adminReviewTask)
      .set({ status: "pending", resolvedAt: null, resolvedByUserId: null })
      .where(eq(adminReviewTask.id, existingTask.id));
    log.warn({ sourceOfFundsId }, "source_of_funds_review_task_reactivated");
  }

  const createdTask = existing.length === 0;
  if (createdTask) {
    await db.insert(adminReviewTask).values({
      kind: "source_of_funds_review",
      status: "pending",
      targetLotId: null,
      payload: {
        sourceOfFundsId,
        userId: payload.userId ?? null,
        trigger: payload.trigger ?? null,
        thresholdAmount: payload.thresholdAmount ?? null,
        exposureAmount: payload.exposureAmount ?? null,
        currency: payload.currency ?? null,
      },
    });
    log.warn(
      {
        sourceOfFundsId,
        userId: payload.userId ?? null,
        trigger: payload.trigger ?? null,
        exposureAmount: payload.exposureAmount ?? null,
      },
      "source_of_funds_review_task_created",
    );
  }

  return { createdTask };
}
