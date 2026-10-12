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
      vatAmountPence: number;
      storefrontUrl: string;
      lines: Array<{
        artworkTitle: string;
        artworkSlug: string;
        editionNumber: number | null;
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
      artworkUrl: string;
      identitySubjectId: string;
      opsEmail: string;
      salesChannel: "shop" | "art";
      message?: string | undefined;
      contactPhone?: string | undefined;
    },
  ): Promise<void>;

  /** Staff alert for a lax.art general enquiry (contact, viewing, advisory, selling). */
  queueGeneralEnquiryAlert(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      identitySubjectId: string;
      opsEmail: string;
      topic: "general" | "private_viewing" | "art_advisory" | "selling" | "exhibition";
      contextSlug: string | null;
      message: string;
      phone: string | null;
    },
  ): Promise<void>;

  queueEditionAvailable(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      identitySubjectId: string;
      artworkSlug: string;
      artworkTitle: string;
      artworkUrl: string;
    },
  ): Promise<void>;

  queueCheckoutOpsAlert(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      opsEmail: string;
      alertKind: string;
      orderId: string;
      detail: string;
    },
  ): Promise<void>;

  queueDispatchNotice(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      identitySubjectId: string;
      fallbackEmail: string | null;
      artworkTitle: string;
      trackingUrl: string | null;
      fulfilmentSummary: string;
    },
  ): Promise<void>;

  queueRefundIssued(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      identitySubjectId: string;
      fallbackEmail: string | null;
      orderId: string;
      amountPence: number;
    },
  ): Promise<void>;
};
