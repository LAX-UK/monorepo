import type { OrderRecord } from "./commerce.ports.js";

/**
 * Whether an email already belongs to a LAX account. Identity answers yes or no and nothing
 * else; the adapter throws when Identity cannot be reached, so callers fail closed.
 */
export interface LaxAccountDirectory {
  hasAccount(normalisedEmail: string): Promise<boolean>;
}

/** What the guest gave at checkout. The email is already normalised. */
export type GuestContact = {
  email: string;
  name?: string;
  phone?: string;
  marketingConsent: boolean;
};

/**
 * The guest behind orders, and the Shop lead. Recording is idempotent per email: a second visit
 * updates the same row, and the lead is published to the CRM only when it is new or changes.
 */
export interface GuestCustomerStore {
  record(contact: GuestContact, now: Date): Promise<{ guestCustomerId: string }>;
}

export type GuestOrderLinkIssue = { token: string; expiresAt: Date };

export type GuestOrderLinkResolution =
  | { kind: "not_found" }
  | { kind: "expired"; orderReference: string }
  | { kind: "claimed"; orderReference: string }
  | {
      kind: "valid";
      order: OrderRecord;
      /** The order's owner value, for reading the invoice through the same path as accounts. */
      subject: string;
      email: string;
      expiresAt: Date;
    };

/** The emailed link that opens one guest order without an account. */
export interface GuestOrderLinks {
  issue(orderId: string, now: Date): Promise<GuestOrderLinkIssue>;
  resolve(token: string, now: Date): Promise<GuestOrderLinkResolution>;
  /**
   * Emails a fresh link when the reference names a guest order of that email that is still a
   * guest order. Says nothing about whether it matched.
   */
  resend(input: { email: string; orderReference: string; now: Date }): Promise<void>;
  /**
   * The guest left the payment page: the unpaid order is cancelled, its prints released and its
   * lines put back in the browser's basket. Does nothing for an order that is no longer unpaid.
   */
  cancelUnpaid(input: { token: string; basketTokenHash: string; now: Date }): Promise<void>;
}

/**
 * Moves a guest's orders and the enquiries they sent as a guest to the LAX account that verified
 * the same email. Idempotent: a second call for the same email claims nothing more.
 */
export interface GuestOrderClaimer {
  claimForVerifiedEmail(input: {
    subjectId: string;
    email: string;
  }): Promise<{ claimedOrders: number; claimedEnquiries: number }>;
}
