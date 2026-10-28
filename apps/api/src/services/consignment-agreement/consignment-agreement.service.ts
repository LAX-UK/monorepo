import {
  canAcceptConsignmentAgreement,
  decideAgreementAcceptance,
  dueAgreementReminder,
} from "@auction/domain";
import type {
  IConsignmentAgreementRepository,
  ILegalEntityNotificationRecipientReader,
} from "@auction/persistence/interfaces";
import type {
  ConsignmentAgreement,
  ConsignmentAgreementView,
  ItemSubmission,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { AgreementSellerContext } from "../interfaces/submission-routes/consignment-agreement-http.js";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

/** The ports the agreement service needs, and nothing else. */
export type ConsignmentAgreementServiceDeps = {
  agreements: IConsignmentAgreementRepository;
  submissions: { findById(id: string): Promise<ItemSubmission | null> };
  people: { findById(id: string): Promise<{ name: string } | null> };
  dispatcher: Pick<NotificationDispatcher, "dispatch">;
  recipients: ILegalEntityNotificationRecipientReader | null;
  events: IDomainEventSink | null;
  now?: () => Date;
};

export interface IConsignmentAgreementService {
  getForSeller(
    submissionId: string,
    seller: AgreementSellerContext,
  ): Promise<Result<ConsignmentAgreementView, SubmissionError>>;
  getForStaff(submissionId: string): Promise<ConsignmentAgreement | null>;
  listForSeller(legalEntityId: string): Promise<ConsignmentAgreement[]>;
  accept(
    submissionId: string,
    seller: AgreementSellerContext,
    termsVersion: string,
  ): Promise<Result<ConsignmentAgreement, SubmissionError>>;
  sendDueReminders(input?: { batchLimit?: number }): Promise<{ reminded: number }>;
}

const REFUSAL_STATUS = {
  not_found: 404,
  not_proposed: 409,
  forbidden_role: 403,
  stale_terms: 409,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The consignment agreement in the product: the seller reads the specialist's estimate and the
 * seller conditions, and accepts them; staff read whether they did; reminders go out at 3 and
 * 7 days while they have not. The rules live in the domain; this service fetches the facts and
 * records the outcome.
 */
export class ConsignmentAgreementService implements IConsignmentAgreementService {
  constructor(private readonly deps: ConsignmentAgreementServiceDeps) {}

  private now(): Date {
    return this.deps.now?.() ?? new Date();
  }

  private async withAcceptorName(agreement: ConsignmentAgreement): Promise<ConsignmentAgreement> {
    if (!agreement.acceptedByUserId) return { ...agreement, acceptedByName: null };
    const person = await this.deps.people.findById(agreement.acceptedByUserId).catch(() => null);
    return { ...agreement, acceptedByName: person?.name ?? null };
  }

  async getForSeller(
    submissionId: string,
    seller: AgreementSellerContext,
  ): Promise<Result<ConsignmentAgreementView, SubmissionError>> {
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission || submission.legalEntityId !== seller.legalEntityId) {
      return err(new SubmissionError("Not found", 404));
    }
    const agreement = await this.deps.agreements.findBySubmissionId(submissionId);
    return ok({
      agreement: agreement ? await this.withAcceptorName(agreement) : null,
      canAccept: canAcceptConsignmentAgreement(seller.actor),
    });
  }

  async getForStaff(submissionId: string): Promise<ConsignmentAgreement | null> {
    const agreement = await this.deps.agreements.findBySubmissionId(submissionId);
    return agreement ? this.withAcceptorName(agreement) : null;
  }

  listForSeller(legalEntityId: string): Promise<ConsignmentAgreement[]> {
    return this.deps.agreements.listByLegalEntity(legalEntityId);
  }

  async accept(
    submissionId: string,
    seller: AgreementSellerContext,
    termsVersion: string,
  ): Promise<Result<ConsignmentAgreement, SubmissionError>> {
    const submission = await this.deps.submissions.findById(submissionId);
    if (!submission || submission.legalEntityId !== seller.legalEntityId) {
      return err(new SubmissionError("Not found", 404));
    }
    const agreement = await this.deps.agreements.findBySubmissionId(submissionId);
    const decision = decideAgreementAcceptance({
      agreement,
      actingLegalEntityId: seller.legalEntityId,
      actor: seller.actor,
      termsVersion,
    });
    if (decision.kind === "refused") {
      return err(new SubmissionError(decision.message, REFUSAL_STATUS[decision.reason]));
    }
    if (decision.kind === "already_accepted" && agreement) {
      return ok(await this.withAcceptorName(agreement));
    }
    const acceptedAt = this.now();
    const stored = await this.deps.agreements.accept({
      submissionId,
      acceptedByUserId: seller.userId,
      acceptedAt,
    });
    if (!stored) return err(new SubmissionError("Not found", 404));
    // Another request may have accepted first; only the request that recorded it reports it.
    if (
      stored.acceptedByUserId === seller.userId &&
      stored.acceptedAt?.getTime() === acceptedAt.getTime()
    ) {
      await this.deps.events?.publish({
        aggregateType: "submission",
        aggregateId: submissionId,
        eventType: "submission.agreement_accepted",
        payload: { submissionId, termsVersion: stored.termsVersion },
        actorUserId: seller.userId,
        actingLegalEntityId: seller.legalEntityId,
        schemaVersion: 1,
      });
    }
    return ok(await this.withAcceptorName(stored));
  }

  async sendDueReminders(input: { batchLimit?: number } = {}): Promise<{ reminded: number }> {
    const now = this.now();
    const proposedBefore = new Date(now.getTime() - 3 * DAY_MS);
    const awaiting = await this.deps.agreements.listAwaiting(
      proposedBefore,
      input.batchLimit ?? 200,
    );
    let reminded = 0;
    for (const agreement of awaiting) {
      const day = dueAgreementReminder(agreement, now);
      if (day === null) continue;
      // Marking first makes the job idempotent: a parallel or repeated run finds it marked.
      const marked = await this.deps.agreements.markReminderSent(agreement.id, day, now);
      if (!marked) continue;
      const recipients = await resolveLegalEntityNotificationRecipients(this.deps.recipients, {
        legalEntityId: agreement.legalEntityId,
        fallbackUserId: agreement.legalEntityId,
        audience: "seller",
      });
      for (const recipientId of recipients) {
        await this.deps.dispatcher.dispatch(recipientId, {
          type: "consignment_agreement_reminder",
          title: "Your consignment agreement is waiting",
          message: `Accept the consignment agreement for "${agreement.submissionTitle}" so we can catalogue it for sale.`,
          submissionId: agreement.submissionId,
        });
      }
      reminded += 1;
    }
    return { reminded };
  }
}
