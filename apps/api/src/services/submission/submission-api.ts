import type {
  CreateItemSubmissionInput,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
  UpdateItemSubmissionInput,
  UserRole,
} from "@auction/types";
import {
  canAccessAdminSubmissionNotesWrite,
  canAccessAdminSubmissionsRead,
  normalizeUserStaffRole,
} from "@auction/types";
import { adminSubmissionNotesSchema, updateItemSubmissionSchema } from "@auction/validators";
import { type Result, ok } from "neverthrow";
import type { SubmissionError } from "../../lib/errors.js";
import { presentSubmissionImages, presentSubmissionsImages } from "../../lib/media-presenters.js";
import type { ApproveSubmissionInput } from "../interfaces/item-submission-service.js";
import type { ListSubmissionsFilter } from "../interfaces/repositories.js";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import { accept, approve, reject } from "./submission-admin-decisions.js";
import { assignForAdmin, startReview } from "./submission-admin-review.js";
import { convert } from "./submission-convert-to-lot.js";
import { getForAdmin, getForSeller, listForAdmin, listForSeller } from "./submission-read.js";
import {
  createDraft,
  submitForReview,
  updateForActor,
  withdraw,
} from "./submission-seller-lifecycle.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

export async function listSubmissionsForSellerApi(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  f: ListSubmissionsFilter,
): Promise<{ data: ItemSubmission[]; total: number }> {
  const countFilter: Omit<ListSubmissionsFilter, "limit" | "offset"> = {
    ...(f.status ? { status: f.status } : {}),
    ...(f.statuses && f.statuses.length > 0 ? { statuses: f.statuses } : {}),
    ...(f.q ? { q: f.q } : {}),
  };
  const [rows, total] = await Promise.all([
    listForSeller(deps, legalEntityId, f),
    deps.submissions.countForLegalEntity(legalEntityId, countFilter),
  ]);
  const data = await presentSubmissionsImages(deps.mediaUrlResolver, rows, deps.mediaAssetEnricher);
  return { data, total };
}

export async function getSubmissionSummaryForSellerApi(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
): Promise<{ counts: Record<ItemSubmissionStatus, number>; total: number }> {
  const counts = await deps.submissions.countStatusForLegalEntity(legalEntityId);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return { counts, total };
}

export async function listSubmissionsForAdminApi(
  deps: ItemSubmissionServiceDeps,
  f: ListSubmissionsFilter,
): Promise<{ data: ItemSubmission[]; total: number }> {
  const countFilter: Omit<ListSubmissionsFilter, "limit" | "offset"> = {
    legalEntityId: f.legalEntityId,
    q: f.q,
    ...(f.statuses && f.statuses.length > 0 ? { statuses: f.statuses } : {}),
    ...(f.status && !(f.statuses && f.statuses.length > 0) ? { status: f.status } : {}),
    ...(f.qualityGaps ? { qualityGaps: true } : {}),
    ...(f.assignedToUserId ? { assignedToUserId: f.assignedToUserId } : {}),
  };
  const [rows, total] = await Promise.all([
    listForAdmin(deps, f),
    deps.submissions.countAdmin(countFilter),
  ]);
  const data = await presentSubmissionsImages(deps.mediaUrlResolver, rows, deps.mediaAssetEnricher);
  return { data, total };
}

export async function getSubmissionForViewerApi(
  deps: ItemSubmissionServiceDeps,
  input: {
    submissionId: string;
    role: UserRole;
    staffRole?: string | null;
    sellerLegalEntityId: string;
  },
): Promise<Result<ItemSubmission, SubmissionError>> {
  const { submissionId, role, staffRole, sellerLegalEntityId } = input;
  const staff = normalizeUserStaffRole(staffRole);
  const result = canAccessAdminSubmissionsRead(role, staff)
    ? await getForAdmin(deps, submissionId)
    : await getForSeller(deps, sellerLegalEntityId, submissionId);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}

export async function patchSubmissionFromRequestBody(
  deps: ItemSubmissionServiceDeps,
  input: {
    rawBody: unknown;
    submissionId: string;
    role: UserRole;
    staffRole?: string | null;
    userId: string;
    sellerLegalEntityId: string;
  },
): Promise<
  | { kind: "ok"; data: ItemSubmission }
  | { kind: "bad_request"; details: unknown }
  | { kind: "err"; error: SubmissionError }
> {
  const { rawBody, submissionId, role, staffRole, userId, sellerLegalEntityId } = input;
  const staff = normalizeUserStaffRole(staffRole);
  if (canAccessAdminSubmissionNotesWrite(role, staff)) {
    const parsed = adminSubmissionNotesSchema.safeParse(rawBody);
    if (!parsed.success) {
      return { kind: "bad_request", details: parsed.error.flatten() };
    }
    const result = await updateForActor(deps, {
      actorId: userId,
      role,
      staffRole: staffRole ?? null,
      submissionId,
      adminNotes: parsed.data,
    });
    if (result.isErr()) return { kind: "err", error: result.error };
    return {
      kind: "ok",
      data: await presentSubmissionImages(
        deps.mediaUrlResolver,
        result.value,
        deps.mediaAssetEnricher,
      ),
    };
  }
  const parsed = updateItemSubmissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return { kind: "bad_request", details: parsed.error.flatten() };
  }
  const result = await updateForActor(deps, {
    actorId: sellerLegalEntityId,
    role,
    staffRole: staffRole ?? null,
    submissionId,
    sellerPatch: parsed.data as UpdateItemSubmissionInput,
  });
  if (result.isErr()) return { kind: "err", error: result.error };
  return {
    kind: "ok",
    data: await presentSubmissionImages(
      deps.mediaUrlResolver,
      result.value,
      deps.mediaAssetEnricher,
    ),
  };
}

export async function createDraftForSellerApi(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  input: CreateItemSubmissionInput,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const result = await createDraft(deps, legalEntityId, input);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}

export async function submitForReviewForSellerApi(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  id: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const result = await submitForReview(deps, legalEntityId, id);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}

export async function withdrawForSellerApi(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  id: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const result = await withdraw(deps, legalEntityId, id);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}

export async function startReviewForAdminApi(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const result = await startReview(deps, adminId, id);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}

export async function assignForAdminApi(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  assignedToUserId: string | null,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const result = await assignForAdmin(deps, adminId, id, assignedToUserId);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}

export async function countQualityGapsForAdminApi(
  deps: ItemSubmissionServiceDeps,
): Promise<number> {
  return deps.submissions.countAdmin({
    statuses: ["submitted", "under_review"],
    qualityGaps: true,
  });
}

export async function countSubmissionsBySellersForAdminApi(
  deps: ItemSubmissionServiceDeps,
  sellerIds: readonly string[],
): Promise<number> {
  return deps.submissions.countAdminForLegalEntityIds(sellerIds);
}

export async function sendStaleDraftReminders(
  deps: ItemSubmissionServiceDeps,
  input: {
    staleDays: number;
    batchLimit?: number;
    maxBatches?: number;
  },
): Promise<{ reminded: number }> {
  const batchLimit = input.batchLimit ?? 50;
  const maxBatches = input.maxBatches ?? 10;
  const cutoff = new Date(Date.now() - input.staleDays * 24 * 60 * 60 * 1000);
  let reminded = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await deps.submissions.listStaleDraftsWithoutReminder(cutoff, batchLimit);
    if (rows.length === 0) break;
    for (const s of rows) {
      if (!s.legalEntityId) continue;
      const recipients = await resolveLegalEntityNotificationRecipients(
        deps.legalEntityNotificationRecipients,
        { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
      );
      for (const recipientId of recipients) {
        await deps.dispatcher.dispatch(recipientId, {
          type: "submission_draft_reminder",
          title: "Submission waiting",
          message: `Your in-progress submission "${s.title}" has not been updated in ${input.staleDays} days. Resume when you are ready to submit for review.`,
          submissionId: s.id,
        });
      }
      await deps.submissions.update(s.id, { draftReminderSentAt: new Date() });
      reminded += 1;
    }
    if (rows.length < batchLimit) break;
  }
  return { reminded };
}

export async function acceptForAdminApi(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  body: Pick<ApproveSubmissionInput, "reviewNotes">,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const result = await accept(deps, adminId, id, body);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}

export async function convertForAdminApi(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  body: ApproveSubmissionInput,
): Promise<
  Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
> {
  const result = await convert(deps, adminId, id, body);
  if (result.isErr()) return result;
  const submission = await presentSubmissionImages(
    deps.mediaUrlResolver,
    result.value.submission,
    deps.mediaAssetEnricher,
  );
  return ok({
    submission,
    lot: result.value.lot,
    readinessPercent: result.value.readinessPercent,
  });
}

export async function approveForAdminApi(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  body: ApproveSubmissionInput,
): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
  const result = await approve(deps, adminId, id, body);
  if (result.isErr()) return result;
  const submission = await presentSubmissionImages(
    deps.mediaUrlResolver,
    result.value.submission,
    deps.mediaAssetEnricher,
  );
  return ok({ submission, lot: result.value.lot });
}

export async function rejectForAdminApi(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  rejectionReason: string,
  reviewNotes?: string | undefined,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const result = await reject(deps, adminId, id, rejectionReason, reviewNotes);
  if (result.isErr()) return result;
  return ok(
    await presentSubmissionImages(deps.mediaUrlResolver, result.value, deps.mediaAssetEnricher),
  );
}
