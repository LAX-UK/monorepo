import { LONDON_TIME_ZONE, formatDate } from "@auction/datetime";
import { type PaymentReminderStep, dealReminderToSend } from "@auction/domain";
import { minorUnitsToMoneyString } from "@auction/domain";
import type { IInvoiceRecipients } from "@auction/finance-runtime";
import type {
  DealReminderCandidate,
  IPrivateSaleDealReminderStore,
} from "@auction/persistence/interfaces";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
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
  now?: () => Date;
};

/**
 * Reminds the buyer of a deal's two deadlines: to pay once the invoice is issued, and to collect
 * the work once it is paid. The schedule is the lot invoice's (two days before, the day itself,
 * three days after) and lives in the domain; the days to each deadline are the deal's own,
 * set from the private sale settings when the invoice is issued and the deal is paid. Each step
 * is taken before it is sent, so a repeated or parallel run sends it once, and it is given back if
 * the send fails.
 */
export class DealReminderService {
  constructor(private readonly deps: DealReminderServiceDeps) {}

  async sendDueReminders(input: { batchLimit?: number } = {}): Promise<{ reminded: number }> {
    const now = this.deps.now?.() ?? new Date();
    const candidates = await this.deps.store.listCandidates(input.batchLimit ?? 200);
    let reminded = 0;
    for (const candidate of candidates) {
      const step = await this.stepFor(candidate, now);
      if (!step) continue;
      if (!(await this.deps.store.claim(candidate.dealId, candidate.kind, step))) continue;
      try {
        if (await this.send(candidate, step)) reminded += 1;
      } catch (error) {
        await this.deps.store.release(candidate.dealId, candidate.kind, step);
        console.error("[DealReminderService] reminder failed", candidate.dealId, error);
      }
    }
    return { reminded };
  }

  /** Stages the reminder for each person; `false` when the buyer is not chased. */
  private async send(candidate: DealReminderCandidate, step: PaymentReminderStep) {
    const eligibility =
      candidate.kind === "payment"
        ? await this.deps.eligibility?.check({
            payerUserId: candidate.buyerUserId,
            buyerLegalEntityId: candidate.buyerLegalEntityId,
          })
        : undefined;
    // A closed account is not chased for payment.
    if (eligibility?.kind === "refused") return false;
    const held = eligibility?.kind === "held" ? eligibility.reason : null;
    const recipients = await this.deps.recipients.forInvoice({
      buyerLegalEntityId: candidate.buyerLegalEntityId,
      winnerUserId: candidate.buyerUserId,
    });
    const dueDate = formatDate(candidate.dueAt, LONDON_TIME_ZONE, { month: "long" });
    for (const recipientId of recipients) {
      const row =
        candidate.kind === "payment"
          ? this.deps.factory.createPaymentReminder({
              userId: recipientId,
              legalEntityId: candidate.buyerLegalEntityId,
              lotId: null,
              lotTitle: candidate.workTitle,
              paymentId: candidate.dealId,
              amount: minorUnitsToMoneyString(BigInt(candidate.amountDueMinor ?? 0)),
              dueDate,
              step,
              // The email calls what is owed a work, not a lot.
              privateSale: true,
              held,
            })
          : this.deps.factory.createDealCollectionReminder({
              userId: recipientId,
              legalEntityId: candidate.buyerLegalEntityId,
              dealId: candidate.dealId,
              workTitle: candidate.workTitle,
              dueDate,
              step,
            });
      await this.deps.outbox.stageDispatch({
        userId: recipientId,
        payload: notificationRowToPayload(row),
        idempotencyKey: `private_sale_${candidate.kind}_reminder:${candidate.dealId}:${step}:${recipientId}`,
      });
    }
    return true;
  }

  private async stepFor(
    candidate: DealReminderCandidate,
    now: Date,
  ): Promise<PaymentReminderStep | null> {
    const step = dealReminderToSend(
      {
        kind: candidate.kind,
        stage: candidate.stage,
        dueAt: candidate.dueAt,
        sentSteps: candidate.sentSteps,
      },
      now,
    );
    // Nothing to chase for a payment of nothing, and a buyer held for LAX's own checks is not
    // asked to pay.
    if (!step || candidate.kind !== "payment") return step;
    if (candidate.amountDueMinor === null) return null;
    if (!this.deps.compliance) return step;
    const hold = await this.deps.compliance.peek(candidate.buyerUserId);
    return hold.hold ? null : step;
  }
}
