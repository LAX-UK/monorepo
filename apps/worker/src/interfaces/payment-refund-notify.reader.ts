import type { EntityRecipient } from "./notification-fanout.reader.js";

export interface IPaymentRefundNotifyReader {
  getRefundContext(
    paymentId: string,
    sellerLegalEntityId: string,
  ): Promise<{
    lotTitle: string;
    lotReference: string | null;
    entityName: string;
    sellerMembers: EntityRecipient[];
  } | null>;
}
