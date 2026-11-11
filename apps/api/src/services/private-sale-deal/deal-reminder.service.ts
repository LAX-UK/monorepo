import { LONDON_TIME_ZONE, formatDate } from "@auction/datetime";
import { dealReminderOpen, dealReminderToSend } from "@auction/domain";
import { minorUnitsToMoneyString } from "@auction/domain";
import type { IInvoiceRecipients } from "@auction/finance-runtime";
import type {
  DealReminderCandidate,
  IPrivateSaleDealReminderStore,
  IRecipientZoneReader,
} from "@auction/persistence/interfaces";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import { stageForRecipientsDue } from "../buyer-default/reminder-recipient-schedule.js";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { IPaymentEligibilityGate } from "../payment/payment-eligibility.gate.js";

export type DealReminderServiceDeps = {
  store: IPrivateSaleDealReminderStore;
  /** Tells whether LAX itself is holding the buyer (AML or source of funds). */
  compliance: Pick<ISettlementCompliancePolicy, "peek"> | null;
  /** Each reminder is staged for each person with its own key, so nobody gets it twice. */
  outbox: Pick<INotificationOutboxService, "stageDispatch">;
  factory: Pick<INotificationFactory, "createPaymentReminder" | "createDealCollectionReminder">;
  /** Who is reminded: the person acting for the buyer and the account's payers. */
  recipients: IInvoiceRecipients;
  /** Whether the account can pay yet; a held payment's reminder says what to do instead. */
  eligibility?: Pick<IPaymentEligibilityGate, "check">;
  /** Each recipient's saved Account zone: a payment reminder reaches them at 09:00 their time. */
  zones: IRecipientZoneReader;
  now?: () => Date;
};

/**
 * Reminds the buyer of a deal's two deadlines: to pay once the invoice is issued, and to collect
 * the work once it is paid. The schedule is the lot invoice's (two days before, the day itself,
 * three days after) and lives in the domain; the days to each deadline are the deal's own,
 * set from the private sale settings when the invoice is issued and the deal is paid.
 *
 * A payment reminder reaches each person at 09:00 on their own clock (London with no saved zone):
 * it is staged for each whose time has come, and the step is taken only when everyone has it. A
 * collection is a visit to a place, so it is taken first and sent to everyone at 09:00 London; it
 * is given back if the send fails.
 */
export class DealReminderService {
  constructor(private readonly deps: DealReminderServiceDeps) {}

  async sendDueReminders(input: { batchLimit?: number } = {}): Promise<{ reminded: number }> {
    const now = this.deps.now?.() ?? new Date();
    const candidates = await this.deps.store.listCandidates(input.batchLimit ?? 200);
    let reminded = 0;
    for (const candidate of candidates) {
      try {
        if (candidate.kind === "payment") {
          if (await this.sendPaymentReminder(candidate, now)) reminded += 1;
        } else if (await this.sendCollectionReminder(candidate, now)) {
          reminded += 1;
        }
      } catch (error) {
        console.error("[DealReminderService] reminder failed", candidate.dealId, error);
      }
    }
    return { reminded };
  }

  private async sendCollectionReminder(candidate: DealReminderCandidate, now: Date) {
    const step = dealReminderToSend(this.factsOf(candidate), now);
    if (!step) return false;
    if (!(await this.deps.store.claim(candidate.dealId, candidate.kind, step))) return false;
    try {
      const recipients = await this.recipientsOf(candidate);
      for (const recipientId of recipients) {
        await this.deps.outbox.stageDispatch({
          userId: recipientId,
          payload: notificationRowToPayload(
            this.deps.factory.createDealCollectionReminder({
              userId: recipientId,
              legalEntityId: candidate.buyerLegalEntityId,
              dealId: candidate.dealId,
              workTitle: candidate.workTitle,
              dueDate: this.dueDateOf(candidate),
              step,
            }),
          ),
          idempotencyKey: `private_sale_${candidate.kind}_reminder:${candidate.dealId}:${step}:${recipientId}`,
        });
      }
      return true;
    } catch (error) {
      await this.deps.store.release(candidate.dealId, candidate.kind, step);
      throw error;
    }
  }

  /** `true` when the step was taken: everyone has it, or the buyer is not chased at all. */
  private async sendPaymentReminder(candidate: DealReminderCandidate, now: Date) {
    const open = await this.openPaymentStep(candidate, now);
    if (!open) return false;
    const { step, dueAt } = open;
    const eligibility = await this.deps.eligibility?.check({
      payerUserId: candidate.buyerUserId,
      buyerLegalEntityId: candidate.buyerLegalEntityId,
    });
    // A closed account is not chased for payment.
    if (eligibility?.kind === "refused") {
      await this.deps.store.claim(candidate.dealId, candidate.kind, step);
      return false;
    }
    const held = eligibility?.kind === "held" ? eligibility.reason : null;
    const { everyoneStaged } = await stageForRecipientsDue({
      recipients: await this.recipientsOf(candidate),
      zones: this.deps.zones,
      dueAt,
      step,
      now,
      stage: (recipientId) =>
        this.deps.outbox.stageDispatch({
          userId: recipientId,
          payload: notificationRowToPayload(
            this.deps.factory.createPaymentReminder({
              userId: recipientId,
              legalEntityId: candidate.buyerLegalEntityId,
              lotId: null,
              lotTitle: candidate.workTitle,
              paymentId: candidate.dealId,
              amount: minorUnitsToMoneyString(BigInt(candidate.amountDueMinor ?? 0)),
              dueDate: this.dueDateOf(candidate),
              dueAt,
              step,
              // The email calls what is owed a work, not a lot.
              privateSale: true,
              held,
            }),
          ),
          idempotencyKey: `private_sale_${candidate.kind}_reminder:${candidate.dealId}:${step}:${recipientId}`,
        }),
    });
    return everyoneStaged && (await this.deps.store.claim(candidate.dealId, candidate.kind, step));
  }

  private recipientsOf(candidate: DealReminderCandidate) {
    return this.deps.recipients.forInvoice({
      buyerLegalEntityId: candidate.buyerLegalEntityId,
      winnerUserId: candidate.buyerUserId,
    });
  }

  private dueDateOf(candidate: DealReminderCandidate): string {
    return formatDate(candidate.dueAt, LONDON_TIME_ZONE, { month: "long" });
  }

  private factsOf(candidate: DealReminderCandidate) {
    return {
      kind: candidate.kind,
      stage: candidate.stage,
      dueAt: candidate.dueAt,
      sentSteps: candidate.sentSteps,
    };
  }

  /** Nothing to chase for a payment of nothing, and a buyer held for LAX's own checks is not asked to pay. */
  private async openPaymentStep(candidate: DealReminderCandidate, now: Date) {
    const open = dealReminderOpen(this.factsOf(candidate), now);
    if (!open || candidate.amountDueMinor === null) return null;
    if (!this.deps.compliance) return open;
    const hold = await this.deps.compliance.peek(candidate.buyerUserId);
    return hold.hold ? null : open;
  }
}
