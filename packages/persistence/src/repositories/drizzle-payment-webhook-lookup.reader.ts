import type { Database } from "@auction/db";
import { payment } from "@auction/db/schema";
import type { SQL } from "drizzle-orm";
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
    };
  }
}
