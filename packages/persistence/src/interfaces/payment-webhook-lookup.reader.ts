import type { SQL } from "drizzle-orm";

export type PaymentWebhookRow = {
  id: string;
  sellerLegalEntityId: string;
  status: string;
  amount: string;
  /** The charge recorded as paying this invoice, if any. */
  stripeChargeId?: string | null;
  /** Whether the invoice was ever captured (paid and recorded), whatever its status now. */
  everCaptured?: boolean;
};

export interface IPaymentWebhookLookupReader {
  forConnection(conn: import("@auction/db").Database): IPaymentWebhookLookupReader;
  findPaymentRow(where: SQL): Promise<PaymentWebhookRow | null>;
}
