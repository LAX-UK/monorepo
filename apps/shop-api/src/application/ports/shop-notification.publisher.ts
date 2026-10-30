import type { EnquirySender } from "../enquiry-sender.js";
import type { GeneralEnquiryTopic } from "./editorial.repository.js";

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
      /** "LAX-S-10482", what the shopper quotes. */
      orderReference: string;
      totalPence: number;
      /** VAT included in the total; null when the order recorded no VAT rate. */
      vatAmountPence: number | null;
      storefrontUrl: string;
      /** A guest order's emailed link, which opens the order without an account. */
      guestOrderUrl?: string;
      lines: Array<{
        artworkTitle: string;
        artworkSlug: string;
        editionNumber: number | null;
        unitPricePence: number;
      }>;
    },
  ): Promise<void>;

  /** A fresh link to a guest order, sent when the guest asks for one. */
  queueGuestOrderLink(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      to: string;
      orderReference: string;
      orderUrl: string;
      /** "29 November 2026". */
      expiresOn: string;
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

  /**
   * The sender's copy of an enquiry, with its reference. Goes to the address typed in the form,
   * else the account's.
   */
  queueEnquiryAcknowledgement(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      sender: EnquirySender;
      reference: string;
      storefront: "shop" | "art";
      topic: "artwork" | Exclude<GeneralEnquiryTopic, "order_problem">;
      artworkTitle?: string;
      artworkUrl?: string;
    },
  ): Promise<void>;

  /** Staff alert for a lax.art general enquiry (contact, viewing, advisory, selling). */
  queueGeneralEnquiryAlert(
    tx: ShopNotificationTx,
    input: {
      idempotencyKey: string;
      sender: EnquirySender;
      opsEmail: string;
      topic: GeneralEnquiryTopic;
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
      orderReference: string;
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
      orderReference: string;
      amountPence: number;
    },
  ): Promise<void>;
};
