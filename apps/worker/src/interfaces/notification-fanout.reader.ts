export type EntityRecipient = {
  email: string;
  userId: string;
  firstName: string | null;
};

export interface INotificationFanoutReader {
  listEntityRecipients(legalEntityId: string): Promise<EntityRecipient[]>;
  getEntityDisplayName(legalEntityId: string): Promise<string>;
  getPayoutAmounts(payoutId: string): Promise<{ netAmount: string; currency: string } | null>;
  getLotForVoided(lotId: string): Promise<{
    title: string;
    winnerId: string | null;
    sellerLegalEntityId: string | null;
  } | null>;
  getLotTitle(lotId: string): Promise<string | null>;
  getUserForProxyNotice(
    userId: string,
  ): Promise<{ email: string; name: string | null; firstName: string | null } | null>;
  getWinnerContact(userId: string): Promise<{ email: string; firstName: string | null } | null>;
  getManualReviewContext(
    lotId: string,
    buyerUserId: string,
    sellerLegalEntityId: string,
  ): Promise<{
    lotTitle: string;
    lotReference: string | null;
    buyerEmail: string | null;
    buyerName: string | null;
    sellerEntityName: string;
  }>;
}
