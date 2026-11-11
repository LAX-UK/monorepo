import { LONDON_TIME_ZONE, formatDate } from "@auction/datetime";
import { paymentReminderOpen } from "@auction/domain";
import type { PaymentReminderStep } from "@auction/domain";
import type { IInvoiceRecipients } from "@auction/finance-runtime";
import type {
  IPaymentReminderStore,
  IRecipientZoneReader,
  PaymentReminderCandidate,
} from "@auction/persistence/interfaces";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { IPaymentEligibilityGate } from "../payment/payment-eligibility.gate.js";
import { stageForRecipientsDue } from "./reminder-recipient-schedule.js";

export type PaymentReminderServiceDeps = {
  store: IPaymentReminderStore;
  /** Tells whether LAX itself is holding the buyer (AML or source of funds). */
  compliance: Pick<ISettlementCompliancePolicy, "peek"> | null;
  /** Each reminder is staged for each person with its own key, so nobody gets it twice. */
  outbox: Pick<INotificationOutboxService, "stageDispatch">;
  factory: Pick<INotificationFactory, "createPaymentReminder">;
  /** Who is reminded: the winner and the account's payers. */
  recipients: IInvoiceRecipients;
  /** Whether the account can pay yet; a held invoice's reminder says what to do instead. */
  eligibility?: Pick<IPaymentEligibilityGate, "check">;
  /** Each recipient's saved Account zone: they are reminded at 09:00 on their own clock. */
  zones: IRecipientZoneReader;
  now?: () => Date;
};

/**
 * Reminds buyers of an unpaid invoice: two days before it is due, on the day and three days
 * after. The schedule and the reasons to stay quiet live in the domain. Each person is reminded at
 * 09:00 on their own clock (London when they have no saved zone), on the London day the step falls
 * on; this service reads the candidates, stages the notice for each person whose time has come
 * (the outbox key sends it once) and takes the step only when everyone has it, so a repeated or
 * parallel run sends nothing twice.
 */
export class PaymentReminderService {
  constructor(private readonly deps: PaymentReminderServiceDeps) {}

  async sendDueReminders(input: { batchLimit?: number } = {}): Promise<{ reminded: number }> {
    const now = this.deps.now?.() ?? new Date();
    const candidates = await this.deps.store.listCandidates(input.batchLimit ?? 200);
    let reminded = 0;
    for (const candidate of candidates) {
      const open = await this.openStepFor(candidate, now);
      if (!open) continue;
      const { step, dueAt } = open;
      try {
        const eligibility = candidate.buyerLegalEntityId
          ? await this.deps.eligibility?.check({
              payerUserId: candidate.buyerId,
              buyerLegalEntityId: candidate.buyerLegalEntityId,
            })
          : undefined;
        // A closed account is not chased for payment.
        if (eligibility?.kind === "refused") {
          await this.deps.store.claim(candidate.paymentId, step);
          continue;
        }
        const held = eligibility?.kind === "held" ? eligibility.reason : null;
        const recipients = await this.deps.recipients.forInvoice({
          buyerLegalEntityId: candidate.buyerLegalEntityId,
          winnerUserId: candidate.buyerId,
        });
        const { everyoneStaged } = await stageForRecipientsDue({
          recipients,
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
                  lotId: candidate.lotId,
                  lotTitle: candidate.lotTitle,
                  paymentId: candidate.paymentId,
                  amount: candidate.amount,
                  dueDate: formatDate(dueAt, LONDON_TIME_ZONE, { month: "long" }),
                  dueAt,
                  step,
                  held,
                }),
              ),
              idempotencyKey: `payment_reminder:${candidate.paymentId}:${step}:${recipientId}`,
            }),
        });
        if (everyoneStaged && (await this.deps.store.claim(candidate.paymentId, step))) {
          reminded += 1;
        }
      } catch (error) {
        console.error("[PaymentReminderService] reminder failed", candidate.paymentId, error);
      }
    }
    return { reminded };
  }

  private async openStepFor(candidate: PaymentReminderCandidate, now: Date) {
    const facts = {
      lotStatus: candidate.lotStatus,
      winnerId: candidate.winnerId,
      buyerId: candidate.buyerId,
      payment: {
        status: candidate.paymentStatus,
        raisedAt: candidate.raisedAt,
        dueAt: candidate.dueAt,
      },
      fulfilmentStatus: candidate.fulfilmentStatus,
      onComplianceHold: false,
      sentSteps: candidate.sentSteps as PaymentReminderStep[],
    };
    const open = paymentReminderOpen(facts, now);
    if (!open || !this.deps.compliance) return open;
    const hold = await this.deps.compliance.peek(candidate.buyerId);
    return paymentReminderOpen({ ...facts, onComplianceHold: hold.hold }, now);
  }
}
