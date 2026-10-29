import {
  canTransition,
  evaluateSubmissionQuality,
  sellerCanEditSubmission,
  sellerSubmitTransition,
  transitionErrorMessage,
} from "@auction/domain";
import type { CreateItemSubmissionInput, ItemSubmission } from "@auction/types";
import { type UserRole, canAccessAdminSubmissionNotesWrite } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { UpdateSubmissionActorInput } from "../interfaces/item-submission-service.js";
import {
  assertSellerEntityAllows,
  assertSellerEntityAllowsSubmissions,
  maybeLogRestrictedSellerWrite,
} from "./submission-seller-gate.js";
import { type ItemSubmissionServiceDeps, sellerPatchToRepoPatch } from "./submission-types.js";

export async function createDraft(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  input: CreateItemSubmissionInput,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const gate = await assertSellerEntityAllowsSubmissions(deps, legalEntityId);
  if (gate.isErr()) return err(gate.error);
  const row = await deps.submissions.create({ ...input, legalEntityId });
  await maybeLogRestrictedSellerWrite(deps, legalEntityId, row.id, "create_draft");
  return ok(row);
}

export async function updateForActor(
  deps: ItemSubmissionServiceDeps,
  input: UpdateSubmissionActorInput,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const { actorId, role, staffRoles, submissionId, sellerPatch, adminNotes } = input;
  const s = await deps.submissions.findById(submissionId);
  if (!s) return err(new SubmissionError("Not found", 404));

  const staff = staffRoles;
  if (canAccessAdminSubmissionNotesWrite(role as UserRole, staff)) {
    if (!adminNotes) {
      return err(new SubmissionError("Invalid update body", 400));
    }
    if (s.status !== "submitted" && s.status !== "under_review") {
      return err(
        new SubmissionError("Admin notes are only allowed while submitted or under review"),
      );
    }
    const updated = await deps.submissions.update(submissionId, {
      reviewNotes: adminNotes.reviewNotes ?? null,
    });
    return ok(updated);
  }

  if (s.legalEntityId !== actorId) {
    return err(new SubmissionError("Not found", 404));
  }
  const gate = await assertSellerEntityAllowsSubmissions(deps, s.legalEntityId);
  if (gate.isErr()) return err(gate.error);
  if (!sellerCanEditSubmission(s.status)) {
    return err(new SubmissionError("Only drafts and submissions that need changes can be edited"));
  }
  if (!sellerPatch) {
    return err(new SubmissionError("Invalid update body", 400));
  }
  const patch = sellerPatchToRepoPatch(sellerPatch);
  const updated = await deps.submissions.update(submissionId, patch);
  await maybeLogRestrictedSellerWrite(deps, s.legalEntityId, submissionId, "update_draft");
  if (patch.images !== undefined) {
    await deps.imageCleanup?.enqueueRemovedMany(s.images, patch.images);
  }
  return ok(updated);
}

export async function submitForReview(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  id: string,
  /** Who is sending it; recorded as its sender, if none is yet, so consignors see their own. */
  sentByUserId?: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s || s.legalEntityId !== legalEntityId) return err(new SubmissionError("Not found", 404));
  const gate = await assertSellerEntityAllows(deps, legalEntityId, "submit");
  if (gate.isErr()) return err(gate.error);
  const transition = sellerSubmitTransition(s.status);
  if (!transition) {
    return err(new SubmissionError(transitionErrorMessage(s.status, "submit")));
  }
  const quality = evaluateSubmissionQuality(s);
  if (!quality.canSubmit) {
    return err(
      new SubmissionError(
        "Complete required fields before submitting: title, category, and at least one image",
        400,
      ),
    );
  }
  // The sender is recorded once. Whoever sends it back after changes, the work stays with the
  // person who first sent it, so a consignor never loses it from their own list.
  const updated = await deps.submissions.update(id, {
    status: "submitted",
    ...(sentByUserId && !s.submittedByUserId ? { submittedByUserId: sentByUserId } : {}),
  });
  await maybeLogRestrictedSellerWrite(deps, legalEntityId, id, "submit_for_review");
  const resubmitted = transition === "resubmit";
  if (resubmitted) {
    await deps.domainEventSink?.publish({
      aggregateType: "submission",
      aggregateId: id,
      eventType: "submission.resubmitted",
      payload: { submissionId: id, legalEntityId },
      actorUserId: null,
      actingLegalEntityId: legalEntityId,
      schemaVersion: 1,
    });
  }
  const admins = await deps.users.listStaffIdsForSubmissionNotifications();
  for (const aid of admins) {
    await deps.dispatcher.dispatch(aid, {
      type: "submission_received_for_review",
      title: resubmitted ? "Submission sent back with changes" : "New item submission",
      message: resubmitted
        ? `The seller made the changes you asked for on "${updated.title}" and sent it back for review.`
        : `A seller submitted "${updated.title}" for review.`,
      submissionId: id,
    });
  }
  return ok(updated);
}

export async function withdraw(
  deps: ItemSubmissionServiceDeps,
  legalEntityId: string,
  id: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s || s.legalEntityId !== legalEntityId) return err(new SubmissionError("Not found", 404));
  const gate = await assertSellerEntityAllowsSubmissions(deps, legalEntityId);
  if (gate.isErr()) return err(gate.error);
  if (!canTransition(s.status, "withdraw")) {
    return err(new SubmissionError(transitionErrorMessage(s.status, "withdraw")));
  }
  const updated = await deps.submissions.update(id, { status: "withdrawn" });
  return ok(updated);
}
