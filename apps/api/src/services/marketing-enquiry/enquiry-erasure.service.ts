import { randomUUID } from "node:crypto";
import type {
  AlertSubscriberErasureCounts,
  EnquiryErasureCounts,
  IAlertSubscriberErasureRepository,
  IEnquiryErasureRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";

export const ENQUIRY_ERASURE_REASON_MIN_LENGTH = 5;
export const ENQUIRY_ERASURE_REASON_MAX_LENGTH = 500;

export type EnquiryErasureOutcome =
  | ({ ok: true } & EnquiryErasureCounts & AlertSubscriberErasureCounts)
  | { ok: false; error: "confirmation_mismatch" | "reason_invalid" };

export interface IEnquiryErasure {
  eraseByEmail(input: {
    email: string;
    /** The address typed a second time by staff to confirm. */
    confirmation: string;
    reason: string;
    actorUserId: string;
    /** The data request the erasure answers; kept in the audit event. */
    requestReference?: string;
  }): Promise<EnquiryErasureOutcome>;
}

/**
 * Staff erase a sender's enquiries by email address, for example a visitor without an account who
 * asks to be forgotten. The change and its audit event commit together; the event holds counts, the
 * reason and, when a data request asked for it, the request's reference; never the address. Enquiries tied to a deal are held and reported, not changed.
 * The same address's email-only alert subscriptions on Bid are erased in the same transaction.
 */
export class EnquiryErasureService implements IEnquiryErasure {
  constructor(
    private readonly deps: {
      erasure: IEnquiryErasureRepository;
      alertSubscribers: IAlertSubscriberErasureRepository;
      transactionRunner: ITransactionRunner;
      events: IDomainEventSink;
    },
  ) {}

  async eraseByEmail(input: {
    email: string;
    confirmation: string;
    reason: string;
    actorUserId: string;
    requestReference?: string;
  }): Promise<EnquiryErasureOutcome> {
    const email = input.email.trim().toLowerCase();
    if (input.confirmation.trim().toLowerCase() !== email) {
      return { ok: false, error: "confirmation_mismatch" };
    }
    const reason = input.reason.trim();
    if (
      reason.length < ENQUIRY_ERASURE_REASON_MIN_LENGTH ||
      reason.length > ENQUIRY_ERASURE_REASON_MAX_LENGTH
    ) {
      return { ok: false, error: "reason_invalid" };
    }
    const counts = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const enquiries = await this.deps.erasure.anonymiseInTransaction(tx, {
        kind: "email",
        email,
      });
      const alerts = await this.deps.alertSubscribers.eraseInTransaction(tx, { emails: [email] });
      const changed = { ...enquiries, ...alerts };
      await this.deps.events.withTx(tx).publish({
        aggregateType: "marketing_enquiry_erasure",
        aggregateId: randomUUID(),
        eventType: "marketing_enquiry.erased",
        payload: {
          ...changed,
          reason,
          ...(input.requestReference ? { requestReference: input.requestReference } : {}),
        },
        actorUserId: input.actorUserId,
      });
      return changed;
    });
    return { ok: true, ...counts };
  }
}
