import type { ReleaseAlertConfirmation } from "@auction/shop-domain";

export type ReleaseAlertConsent = { text: string; source: string };

export type ReleaseAlertUnsubscribePreviewModel = { email: string; active: boolean };

/**
 * The release alert list: who asked, who confirmed and who stopped. Each method is one change
 * that must stand on its own, so implementations make it atomic.
 */
export interface ReleaseAlertStore {
  /**
   * Starts a double opt-in request for an address and queues the confirmation email, unless the
   * address is already confirmed or was sent one a moment ago. Says nothing about which.
   */
  requestConfirmation(input: {
    email: string;
    consent: ReleaseAlertConsent;
    now: Date;
  }): Promise<void>;
  /** Subscribes a signed-in shopper's verified address without a confirmation email. */
  subscribeAccount(input: {
    email: string;
    identitySubjectId: string;
    consent: ReleaseAlertConsent;
    now: Date;
  }): Promise<"subscribed" | "already_subscribed">;
  /** Confirms the address a confirmation token was sent to. */
  confirm(
    token: string,
    now: Date,
  ): Promise<Exclude<ReleaseAlertConfirmation, "already_confirmed">>;
  isConfirmed(email: string): Promise<boolean>;
  /** Stops the alerts for an address. Safe to repeat. */
  stopByEmail(email: string, now: Date): Promise<void>;
  /** Null when the token matches no subscription. */
  previewUnsubscribe(token: string): Promise<ReleaseAlertUnsubscribePreviewModel | null>;
  /** False when the token matches no subscription. Safe to repeat. */
  unsubscribe(token: string, now: Date): Promise<boolean>;
}

export type ReleaseAlertCounts = { confirmed: number; awaitingConfirmation: number };

/** What LAX Admin shows about the list. */
export interface ReleaseAlertSummaryReader {
  counts(): Promise<ReleaseAlertCounts>;
}

/** The artwork a release alert is about. */
export type ReleasedEdition = {
  artworkId: string;
  slug: string;
  title: string;
  artistName: string;
};

/**
 * Emails every confirmed subscriber about a newly published edition, once each. Runs inside
 * the publishing transaction, so the emails exist if and only if the artwork is published.
 */
export interface ReleaseAlertAnnouncer {
  announce(tx: unknown, edition: ReleasedEdition): Promise<{ queued: number }>;
}
