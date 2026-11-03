import { invoiceDueAt, paymentReminderToSend } from "@auction/domain";
import type { PaymentReminderStep } from "@auction/domain";
import type {
  IPaymentReminderStore,
  PaymentReminderCandidate,
} from "@auction/persistence/interfaces";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import type { INotificationFactory } from "../interfaces/notification-factory.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

const DUE_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
});

export type PaymentReminderServiceDeps = {
  store: IPaymentReminderStore;
  /** Tells whether LAX itself is holding the buyer (AML or source of funds). */
  compliance: Pick<ISettlementCompliancePolicy, "peek"> | null;
  dispatcher: Pick<NotificationDispatcher, "dispatch">;
  factory: Pick<INotificationFactory, "createPaymentReminder">;
  now?: () => Date;
};

/**
 * Reminds buyers of an unpaid invoice: two days before it is due, on the day and three days
 * after. The schedule and the reasons to stay quiet live in the domain; this service reads the
 * candidates, takes each step before sending it (so a repeated or parallel run sends it once) and
 * hands the notice to the dispatcher.
 */
export class PaymentReminderService {
  constructor(private readonly deps: PaymentReminderServiceDeps) {}

  async sendDueReminders(input: { batchLimit?: number } = {}): Promise<{ reminded: number }> {
    const now = this.deps.now?.() ?? new Date();
    const candidates = await this.deps.store.listCandidates(input.batchLimit ?? 200);
    let reminded = 0;
    for (const candidate of candidates) {
      const step = await this.stepFor(candidate, now);
      if (!step) continue;
      if (!(await this.deps.store.claim(candidate.paymentId, step))) continue;
      try {
        await this.deps.dispatcher.dispatch(
          candidate.buyerId,
          notificationRowToPayload(
            this.deps.factory.createPaymentReminder({
              userId: candidate.buyerId,
              legalEntityId: candidate.buyerLegalEntityId,
              lotId: candidate.lotId,
              lotTitle: candidate.lotTitle,
              paymentId: candidate.paymentId,
              amount: candidate.amount,
              dueDate: DUE_DATE.format(invoiceDueAt(candidate.raisedAt)),
              step,
            }),
          ),
        );
        reminded += 1;
      } catch (error) {
        await this.deps.store.release(candidate.paymentId, step);
        console.error("[PaymentReminderService] reminder failed", candidate.paymentId, error);
      }
    }
    return { reminded };
  }

  private async stepFor(
    candidate: PaymentReminderCandidate,
    now: Date,
  ): Promise<PaymentReminderStep | null> {
    const facts = {
      lotStatus: candidate.lotStatus,
      winnerId: candidate.winnerId,
      buyerId: candidate.buyerId,
      payment: { status: candidate.paymentStatus, raisedAt: candidate.raisedAt },
      fulfilmentStatus: candidate.fulfilmentStatus,
      onComplianceHold: false,
      sentSteps: candidate.sentSteps as PaymentReminderStep[],
    };
    const step = paymentReminderToSend(facts, now);
    if (!step || !this.deps.compliance) return step;
    const hold = await this.deps.compliance.peek(candidate.buyerId);
    return paymentReminderToSend({ ...facts, onComplianceHold: hold.hold }, now);
  }
}
