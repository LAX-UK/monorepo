import type { EnquirySender } from "../enquiry-sender.js";

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
      sender: EnquirySender;
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
      sender: EnquirySender;
      opsEmail: string;
      topic: "general" | "private_viewing" | "art_advisory" | "selling" | "exhibition";
      contextSlug: string | null;
      message: string;
      phone: string | null;
    },
  ): Promise<void>;

  /** Edition alert: the edition someone asked about can be bought again. */
  queueEditionAvailable(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      /** Resolved by the caller: the account's address, else the one the guest gave. */
      to: string;
      artworkSlug: string;
      artworkTitle: string;
      artistName: string;
      artworkUrl: string;
      /** Stops this address's alerts without signing in; also sent as List-Unsubscribe. */
      unsubscribeUrl: string;
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
