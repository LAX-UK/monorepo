import {
  CONSIGNMENT_AGREEMENT_TERMS_VERSION,
  SELLER_IDENTITY_REQUIRED_CODE,
  SELLER_IDENTITY_REQUIRED_MESSAGE,
  canTransition,
  evaluateSubmissionQuality,
  sellerIdentityVerified,
  transitionErrorMessage,
} from "@auction/domain";
import type { ItemSubmission, Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type {
  AcceptSubmissionInput,
  ApproveSubmissionInput,
} from "../interfaces/item-submission-service.js";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import { convert } from "./submission-convert-to-lot.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

/** Records the specialist's estimate and terms as the agreement the seller is asked to accept. */
async function proposeAgreement(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  submission: { id: string; legalEntityId: string },
  input: AcceptSubmissionInput | undefined,
  at: Date,
): Promise<void> {
  if (!deps.consignmentAgreements) return;
  const proposal = input?.proposal;
  await deps.consignmentAgreements.propose({
    submissionId: submission.id,
    legalEntityId: submission.legalEntityId,
    termsVersion: CONSIGNMENT_AGREEMENT_TERMS_VERSION,
    estimateLow: proposal?.estimateLow ?? null,
    estimateHigh: proposal?.estimateHigh ?? null,
    reservePrice: proposal?.reservePrice ?? null,
    commissionPercent: proposal?.commissionPercent ?? null,
    currency: proposal?.currency ?? "GBP",
    proposedByUserId: adminId,
    proposedAt: at,
  });
}

export async function accept(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  input: AcceptSubmissionInput | undefined = undefined,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s) return err(new SubmissionError("Not found", 404));
  if (!canTransition(s.status, "accept")) {
    return err(new SubmissionError(transitionErrorMessage(s.status, "accept")));
  }
  if (!s.legalEntityId) {
    return err(new SubmissionError("Legal entity context missing", 400));
  }
  const quality = evaluateSubmissionQuality(s);
  if (!quality.canAccept) {
    return err(
      new SubmissionError("Submission does not meet minimum requirements for acceptance", 400),
    );
  }
  if (deps.sellerIdentity) {
    const identity = await deps.sellerIdentity.factsFor(s.legalEntityId);
    if (!identity || !sellerIdentityVerified(identity)) {
      return err(
        new SubmissionError(SELLER_IDENTITY_REQUIRED_MESSAGE, 409, SELLER_IDENTITY_REQUIRED_CODE),
      );
    }
  }
  const now = new Date();
  const updated = await deps.submissions.update(id, {
    status: "approved",
    reviewedBy: adminId,
    reviewedAt: now,
    reviewNotes: input?.reviewNotes?.trim() ? input.reviewNotes.trim() : null,
    rejectionReason: null,
  });
  await proposeAgreement(deps, adminId, { id, legalEntityId: s.legalEntityId }, input, now);
  const recipients = await resolveLegalEntityNotificationRecipients(
    deps.legalEntityNotificationRecipients,
    { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
  );
  for (const recipientId of recipients) {
    await deps.dispatcher.dispatch(recipientId, {
      type: "submission_approved",
      title: "Your work was accepted",
      message: `A specialist accepted "${s.title}" and proposed an estimate and terms. Review and accept the consignment agreement so we can catalogue it.`,
      submissionId: id,
    });
  }
  return ok(updated);
}

/**
 * The specialist needs more from the seller before deciding. The note is shown on the
 * consignment; the seller edits the same submission and sends it back.
 */
export async function requestChanges(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  note: string,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s) return err(new SubmissionError("Not found", 404));
  if (!canTransition(s.status, "requestChanges")) {
    return err(new SubmissionError(transitionErrorMessage(s.status, "requestChanges")));
  }
  if (!s.legalEntityId) {
    return err(new SubmissionError("Legal entity context missing", 400));
  }
  const trimmed = note.trim();
  if (!trimmed) return err(new SubmissionError("Tell the seller what to change", 400));
  const now = new Date();
  const updated = await deps.submissions.update(id, {
    status: "changes_requested",
    changesRequestedNote: trimmed,
    changesRequestedAt: now,
    reviewedBy: adminId,
    reviewedAt: now,
  });
  await deps.domainEventSink?.publish({
    aggregateType: "submission",
    aggregateId: id,
    eventType: "submission.changes_requested",
    payload: { submissionId: id, note: trimmed },
    actorUserId: adminId,
    actingLegalEntityId: null,
    schemaVersion: 1,
  });
  const recipients = await resolveLegalEntityNotificationRecipients(
    deps.legalEntityNotificationRecipients,
    { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
  );
  for (const recipientId of recipients) {
    await deps.dispatcher.dispatch(recipientId, {
      type: "submission_changes_requested",
      title: "Your submission needs changes",
      message: `A specialist asked for changes to "${s.title}": ${trimmed}`,
      submissionId: id,
    });
  }
  return ok(updated);
}

export async function reject(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  rejectionReason: string,
  reviewNotes?: string | undefined,
): Promise<Result<ItemSubmission, SubmissionError>> {
  const s = await deps.submissions.findById(id);
  if (!s) return err(new SubmissionError("Not found", 404));
  if (!canTransition(s.status, "reject")) {
    return err(new SubmissionError(transitionErrorMessage(s.status, "reject")));
  }
  if (!s.legalEntityId) {
    return err(new SubmissionError("Legal entity context missing", 400));
  }
  const updated = await deps.submissions.update(id, {
    status: "rejected",
    reviewedBy: adminId,
    reviewedAt: new Date(),
    reviewNotes: reviewNotes ?? null,
    rejectionReason,
  });
  const recipients = await resolveLegalEntityNotificationRecipients(
    deps.legalEntityNotificationRecipients,
    { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
  );
  for (const recipientId of recipients) {
    await deps.dispatcher.dispatch(recipientId, {
      type: "submission_rejected",
      title: "Submission not accepted",
      message: `Your submission "${s.title}" was not accepted: ${rejectionReason}`,
      submissionId: id,
    });
  }
  return ok(updated);
}

/** Catalogues an accepted submission (kept for older clients; same rules as convert). */
export async function approve(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  input: ApproveSubmissionInput | undefined = undefined,
): Promise<Result<{ submission: ItemSubmission; lot: Lot }, SubmissionError>> {
  if (input?.artistId && input?.newArtist) {
    return err(new SubmissionError("Provide either artistId or newArtist, not both", 400));
  }
  const s = await deps.submissions.findById(id);
  if (!s) return err(new SubmissionError("Not found", 404));
  if (s.status === "under_review") {
    // Accepting and cataloguing in one step would skip the seller's agreement.
    return err(
      new SubmissionError(
        "Accept the submission first. It can be catalogued once the seller accepts the consignment agreement.",
        409,
      ),
    );
  }
  if (s.status !== "approved") {
    return err(new SubmissionError(transitionErrorMessage(s.status, "accept")));
  }
  const converted = await convert(deps, adminId, id, input);
  if (converted.isErr()) return err(converted.error);
  return ok({ submission: converted.value.submission, lot: converted.value.lot });
}

export async function bulkApproveOrReject(
  deps: ItemSubmissionServiceDeps,
  input: {
    adminId: string;
    ids: string[];
    op: "approve" | "reject";
    reason?: string | undefined;
    reviewNotes?: string | undefined;
  },
): Promise<
  | { kind: "ok"; count: number }
  | { kind: "bad_request"; message: string }
  | { kind: "err"; error: SubmissionError }
> {
  const { adminId, ids, op, reason, reviewNotes } = input;
  if (op === "reject" && !reason?.trim()) {
    return { kind: "bad_request", message: "Reason is required to reject submissions" };
  }
  for (const id of ids) {
    if (op === "approve") {
      const s = await deps.submissions.findById(id);
      if (!s) return { kind: "err", error: new SubmissionError("Not found", 404) };
      const quality = evaluateSubmissionQuality(s);
      if (!quality.canAccept) {
        return {
          kind: "bad_request",
          message: `Submission "${s.title}" is missing required fields and cannot be bulk accepted`,
        };
      }
    }
    const result =
      op === "approve"
        ? await accept(deps, adminId, id, { reviewNotes })
        : await reject(deps, adminId, id, reason?.trim() ?? "", reviewNotes);
    if (result.isErr()) {
      return { kind: "err", error: result.error };
    }
  }
  return { kind: "ok", count: ids.length };
}
