import { randomUUID } from "node:crypto";
import type {
  EnquiryErasureCounts,
  IEnquiryErasureRepository,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";

export const ENQUIRY_ERASURE_REASON_MIN_LENGTH = 5;
export const ENQUIRY_ERASURE_REASON_MAX_LENGTH = 500;

export type EnquiryErasureOutcome =
  | ({ ok: true } & EnquiryErasureCounts)
  | { ok: false; error: "confirmation_mismatch" | "reason_invalid" };

export interface IEnquiryErasure {
  eraseByEmail(input: {
    email: string;
    /** The address typed a second time by staff to confirm. */
    confirmation: string;
    reason: string;
    actorUserId: string;
  }): Promise<EnquiryErasureOutcome>;
}

/**
 * Staff erase a sender's enquiries by email address, for example a visitor without an account who
 * asks to be forgotten. The change and its audit event commit together; the event holds counts and
 * the reason, never the address. Enquiries tied to a deal are held and reported, not changed.
 */
export class EnquiryErasureService implements IEnquiryErasure {
  constructor(
    private readonly deps: {
      erasure: IEnquiryErasureRepository;
      transactionRunner: ITransactionRunner;
      events: IDomainEventSink;
    },
  ) {}

  async eraseByEmail(input: {
    email: string;
    confirmation: string;
    reason: string;
    actorUserId: string;
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
      const changed = await this.deps.erasure.anonymiseInTransaction(tx, { kind: "email", email });
      await this.deps.events.withTx(tx).publish({
        aggregateType: "marketing_enquiry_erasure",
        aggregateId: randomUUID(),
        eventType: "marketing_enquiry.erased",
        payload: { ...changed, reason },
        actorUserId: input.actorUserId,
      });
      return changed;
    });
    return { ok: true, ...counts };
  }
}
