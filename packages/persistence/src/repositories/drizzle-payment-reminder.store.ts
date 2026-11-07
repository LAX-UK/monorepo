import type { Database } from "@auction/db";
import { bidInvoice, lot, lotFulfilment, payment, paymentReminder } from "@auction/db/schema";
import { PAYMENT_REMINDER_STEPS } from "@auction/domain";
import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type {
  IPaymentReminderStore,
  PaymentReminderCandidate,
} from "../interfaces/buyer-default.js";

/** Reminders stop mattering once an invoice is this old: staff have long since taken it over. */
const MAX_AGE_DAYS = 90;

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
