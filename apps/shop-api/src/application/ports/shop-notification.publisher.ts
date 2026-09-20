/** Opaque transaction handle passed from infrastructure (same DB tx as the business write). */
export type ShopNotificationTx = unknown;

export type ShopNotificationPublisher = {
  queueOrderReceipt(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      identitySubjectId: string;
      fallbackEmail: string | null;
      orderId: string;
      totalPence: number;
      storefrontUrl: string;
      lines: Array<{
        artworkTitle: string;
        artworkSlug: string;
        editionNumber: number;
        unitPricePence: number;
      }>;
    },
  ): Promise<void>;

  queueEnquiryAlert(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      artworkSlug: string;
      artworkTitle: string;
      identitySubjectId: string;
      opsEmail: string;
    },
  ): Promise<void>;

  queueEditionAvailable(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      identitySubjectId: string;
      artworkSlug: string;
      artworkTitle: string;
      storefrontUrl: string;
    },
  ): Promise<void>;
};
