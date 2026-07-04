import type pino from "pino";
import type { IAdminReviewTaskProjectorRepository } from "../../interfaces/admin-review-task-projector.repository.js";
import type { SourceOfFundsRequiredPayload } from "./sof-review-helpers.js";

export async function manageSourceOfFundsReviewTask(args: {
  adminReviewTaskProjectorRepo: IAdminReviewTaskProjectorRepository;
  log: pino.Logger;
  payload: SourceOfFundsRequiredPayload;
  sourceOfFundsId: string;
}): Promise<{ createdTask: boolean }> {
  const { adminReviewTaskProjectorRepo, log, payload, sourceOfFundsId } = args;

  const existingTask = await adminReviewTaskProjectorRepo.findSourceOfFundsReview(sourceOfFundsId);

  const reopened = Boolean(payload.reopened);
  if (existingTask && reopened) {
    await adminReviewTaskProjectorRepo.reactivateSourceOfFundsReview(existingTask.id);
    log.warn({ sourceOfFundsId }, "source_of_funds_review_task_reactivated");
  }

  const createdTask = existingTask == null;
  if (createdTask) {
    await adminReviewTaskProjectorRepo.createSourceOfFundsReview({
      sourceOfFundsId,
      userId: payload.userId ?? null,
      trigger: payload.trigger ?? null,
      thresholdAmount: payload.thresholdAmount ?? null,
      exposureAmount: payload.exposureAmount ?? null,
      currency: payload.currency ?? null,
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
