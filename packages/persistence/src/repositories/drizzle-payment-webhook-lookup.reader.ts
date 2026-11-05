import type { Database } from "@auction/db";
import { domainEvent, payment } from "@auction/db/schema";
import { type SQL, sql } from "drizzle-orm";
import type {
  IPaymentWebhookLookupReader,
  PaymentWebhookRow,
} from "../interfaces/payment-webhook-lookup.reader.js";

export class DrizzlePaymentWebhookLookupReader implements IPaymentWebhookLookupReader {
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): IPaymentWebhookLookupReader {
    return new DrizzlePaymentWebhookLookupReader(conn);
  }

  async findPaymentRow(where: SQL): Promise<PaymentWebhookRow | null> {
    const [row] = await this.db
      .select({
        id: payment.id,
        sellerLegalEntityId: payment.sellerLegalEntityId,
        status: payment.status,
        amount: payment.amount,
        stripeChargeId: payment.stripeChargeId,
        everCaptured: sql<boolean>`exists (
          select 1 from ${domainEvent} e
          where e.aggregate_type = 'payment'
            and e.aggregate_id = ${payment.id}::text
            and e.event_type = 'payment.captured'
        )`,
      })
      .from(payment)
      .where(where)
      .limit(1);
    if (!row || !row.sellerLegalEntityId) return null;
    return {
      id: row.id,
      sellerLegalEntityId: row.sellerLegalEntityId,
      status: row.status,
      amount: String(row.amount),
      stripeChargeId: row.stripeChargeId ?? null,
      everCaptured: Boolean(row.everCaptured),
    };
  }
}
