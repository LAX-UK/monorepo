import type { SQL } from "drizzle-orm";

export type PaymentWebhookRow = {
  id: string;
  sellerLegalEntityId: string;
  status: string;
  amount: string;
};

export interface IPaymentWebhookLookupReader {
  forConnection(conn: import("@auction/db").Database): IPaymentWebhookLookupReader;
  findPaymentRow(where: SQL): Promise<PaymentWebhookRow | null>;
}
