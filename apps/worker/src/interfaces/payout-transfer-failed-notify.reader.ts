import type { EntityRecipient } from "./notification-fanout.reader.js";

export interface IPayoutTransferFailedNotifyReader {
  getTransferFailedContext(
    legalEntityId: string,
    payoutId: string,
    fallbackAmountCents: number,
    fallbackCurrency: string,
  ): Promise<{
    entityName: string;
    entityKind: string | null;
    payoutAmount: string;
    payoutCurrency: string;
    financeMembers: EntityRecipient[];
  }>;
}
