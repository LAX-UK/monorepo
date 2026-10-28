import {
  SELLER_IDENTITY_REMINDER_INTERVAL_MS,
  SELLER_IDENTITY_REMINDER_NOT_NEEDED_MESSAGE,
  type SellerIdentityFacts,
  decideSellerIdentityReminder,
  sellerIdentityReminderState,
  sellerIdentityVerified,
} from "@auction/domain";
import type { ISellerIdentityReminderStore } from "@auction/persistence/interfaces";
import type { ItemSubmission, SellerIdentityReminderState } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { identityReminderUpdate } from "./after-sale-copy.js";
import type { IConsignmentUpdateNotifier } from "./consignment-update-notifier.js";

export type SellerIdentityReminderServiceDeps = {
  submissions: { findById(id: string): Promise<ItemSubmission | null> };
  identity: { factsFor(legalEntityId: string): Promise<SellerIdentityFacts | null> };
  store: ISellerIdentityReminderStore;
  notifier: IConsignmentUpdateNotifier;
  events: IDomainEventSink | null;
  now?: () => Date;
};

export type SellerIdentityReminderOutcome = SellerIdentityReminderState & {
  /** False when one was already sent inside the window, so nothing went out now. */
  sent: boolean;
};

export interface ISellerIdentityReminderService {
  remind(
    submissionId: string,
    staffUserId: string,
  ): Promise<Result<SellerIdentityReminderOutcome, SubmissionError>>;
}

/**
 * "Remind the seller" on a submission whose acceptance waits for the seller's identity. At most
 * one reminder a day per submission: the store marks it before anything is sent, so a double
 * click or two specialists at once send it once.
 */
export class SellerIdentityReminderService implements ISellerIdentityReminderService {
  constructor(private readonly deps: SellerIdentityReminderServiceDeps) {}

  async remind(
    submissionId: string,
    staffUserId: string,
  ): Promise<Result<SellerIdentityReminderOutcome, SubmissionError>> {
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission?.legalEntityId) return err(new SubmissionError("Not found", 404));
    const facts = await this.deps.identity.factsFor(submission.legalEntityId);
    const now = this.deps.now?.() ?? new Date();
    const lastSentAt = submission.identityReminderSentAt ?? null;
    const decision = decideSellerIdentityReminder({
      submissionStatus: submission.status,
      identityVerified: facts !== null && sellerIdentityVerified(facts),
      lastSentAt,
      now,
    });
    if (decision.kind === "not_needed") {
      return err(
        new SubmissionError(SELLER_IDENTITY_REMINDER_NOT_NEEDED_MESSAGE[decision.reason], 409),
      );
    }
    if (decision.kind === "already_sent") {
      return ok({ ...sellerIdentityReminderState(decision.lastSentAt), sent: false });
    }
    const notSentSince = new Date(now.getTime() - SELLER_IDENTITY_REMINDER_INTERVAL_MS);
    const marked = await this.deps.store.markSent(submission.id, now, notSentSince);
    if (!marked) {
      // Another request marked it first; report its reminder rather than sending a second.
      const fresh = await this.deps.submissions.findById(submission.id);
      return ok({
        ...sellerIdentityReminderState(fresh?.identityReminderSentAt ?? now),
        sent: false,
      });
    }

    await this.deps.notifier.notify(
      [{ legalEntityId: submission.legalEntityId, audience: "admin" }],
      identityReminderUpdate({
        submissionId: submission.id,
        title: submission.title,
        accountKind: facts?.kind ?? "individual",
      }),
    );
    await this.deps.events?.publish({
      aggregateType: "submission",
      aggregateId: submission.id,
      eventType: "submission.identity_reminder_sent",
      payload: { submissionId: submission.id },
      actorUserId: staffUserId,
      actingLegalEntityId: submission.legalEntityId,
      schemaVersion: 1,
    });
    return ok({ ...sellerIdentityReminderState(now), sent: true });
  }
}
