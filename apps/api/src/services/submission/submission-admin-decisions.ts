import { canTransition, evaluateSubmissionQuality, transitionErrorMessage } from "@auction/domain";
import type { ItemSubmission, Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { ApproveSubmissionInput } from "../interfaces/item-submission-service.js";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import { convert } from "./submission-convert-to-lot.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

export async function accept(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  input: Pick<ApproveSubmissionInput, "reviewNotes"> | undefined = undefined,
  options: { notifySeller?: boolean } = {},
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
  const updated = await deps.submissions.update(id, {
    status: "approved",
    reviewedBy: adminId,
    reviewedAt: new Date(),
    reviewNotes: input?.reviewNotes?.trim() ? input.reviewNotes.trim() : null,
    rejectionReason: null,
  });
  if (options.notifySeller !== false) {
    const recipients = await resolveLegalEntityNotificationRecipients(
      deps.legalEntityNotificationRecipients,
      { legalEntityId: s.legalEntityId, fallbackUserId: s.legalEntityId, audience: "seller" },
    );
    for (const recipientId of recipients) {
      await deps.dispatcher.dispatch(recipientId, {
        type: "submission_approved",
        title: "Submission accepted",
        message: `Your submission "${s.title}" was accepted for cataloguing. Our specialists are preparing your catalogue entry.`,
        submissionId: id,
      });
    }
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

/** Backward-compatible: accept then convert in one call. */
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
    const accepted = await accept(
      deps,
      adminId,
      id,
      { reviewNotes: input?.reviewNotes },
      { notifySeller: false },
    );
    if (accepted.isErr()) return err(accepted.error);
  } else if (s.status !== "approved") {
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
