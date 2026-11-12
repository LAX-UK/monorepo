import type { Database } from "@auction/db";
import { bidInvoice, lot, lotFulfilment, payment, paymentReminder } from "@auction/db/schema";
import { PAYMENT_REMINDER_STEPS } from "@auction/domain";
import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";
import { and, asc, eq, gt, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type {
  IPaymentReminderStore,
  PaymentReminderCandidate,
} from "../interfaces/buyer-default.js";

/** Reminders stop mattering once an invoice is this old: staff have long since taken it over. */
const MAX_AGE_DAYS = 90;

/**
 * The first step opens at the London midnight two days before the due day, so an invoice due more
 * than three days from now has no step open yet and is left out of the run. The due date is the
 * stored one, or (a fixture with no stored invoice) the end of the London term from when it was raised.
 */
const FIRST_STEP_LEAD_DAYS = 3;

/**
 * The last step (overdue) closes with the London day three days after the due day, so an invoice
 * due more than four days ago has no open step left. The bound is five days, a day looser than that,
 * so a London clock change cannot shorten the window below the last step. The send-time guard
 * rules out late sends, so a loose bound is safe. Leaving stale rows out stops stale unclaimed rows
 * from filling the batch and starving newer invoices.
 */
const LAST_STEP_TAIL_DAYS = 5;

export class DrizzlePaymentReminderStore implements IPaymentReminderStore {
  constructor(private readonly db: Database) {}

  async listCandidates(limit: number): Promise<PaymentReminderCandidate[]> {
    const rows = await this.db
      .select({
        paymentId: payment.id,
        lotId: payment.lotId,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        lotStatus: lot.status,
        winnerId: lot.winnerId,
        buyerId: payment.buyerId,
        buyerLegalEntityId: payment.buyerLegalEntityId,
        amount: payment.amount,
        paymentStatus: payment.status,
        raisedAt: payment.createdAt,
        dueAt: bidInvoice.dueAt,
        fulfilmentStatus: lotFulfilment.status,
        sentSteps: sql<
          string[] | null
        >`(select array_agg(${paymentReminder.step}) from ${paymentReminder} where ${paymentReminder.paymentId} = ${payment.id})`,
      })
      .from(payment)
      .innerJoin(lot, eq(lot.id, payment.lotId))
      .leftJoin(bidInvoice, eq(bidInvoice.id, payment.invoiceId))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, payment.lotId))
      .where(
        and(
          inArray(payment.status, ["pending", "cancelled"]),
          eq(lot.status, "ended"),
          eq(lot.winnerId, payment.buyerId),
          or(ne(lotFulfilment.status, "cancelled"), sql`${lotFulfilment.status} is null`),
          sql`${payment.createdAt} > now() - make_interval(days => ${MAX_AGE_DAYS})`,
          or(
            and(
              lte(bidInvoice.dueAt, sql`now() + make_interval(days => ${FIRST_STEP_LEAD_DAYS})`),
              gt(bidInvoice.dueAt, sql`now() - make_interval(days => ${LAST_STEP_TAIL_DAYS})`),
            ),
            and(
              isNull(bidInvoice.dueAt),
              sql`${payment.createdAt} + make_interval(days => ${INVOICE_PAYMENT_DUE_DAYS + 1 - FIRST_STEP_LEAD_DAYS}) <= now()`,
              sql`${payment.createdAt} + make_interval(days => ${INVOICE_PAYMENT_DUE_DAYS + 1 + LAST_STEP_TAIL_DAYS}) > now()`,
            ),
          ),
          sql`(select count(*) from ${paymentReminder} where ${paymentReminder.paymentId} = ${payment.id}) < ${PAYMENT_REMINDER_STEPS.length}`,
        ),
      )
      .orderBy(asc(payment.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      ...r,
      amount: String(r.amount),
      sentSteps: r.sentSteps ?? [],
    }));
  }

  async claim(paymentId: string, step: string): Promise<boolean> {
    const rows = await this.db
      .insert(paymentReminder)
      .values({ paymentId, step })
      .onConflictDoNothing()
      .returning({ step: paymentReminder.step });
    return rows.length > 0;
  }

  async release(paymentId: string, step: string): Promise<void> {
    await this.db
      .delete(paymentReminder)
      .where(and(eq(paymentReminder.paymentId, paymentId), eq(paymentReminder.step, step)));
  }
}
