/**
 * Who an edition alert goes to. A guest gives an email address; a signed-in shopper is known by
 * the account, and the store records the account's address alongside it.
 */
export type EditionAlertRecipient =
  | { kind: "guest"; email: string }
  | { kind: "account"; identitySubjectId: string };

export type EditionAlertReadModel = {
  id: string;
  artworkSlug: string;
  artworkTitle: string;
  artistName: string;
  imageUrl: string | null;
  createdAt: Date;
};

export type EditionAlertUnsubscribePreviewModel = {
  maskedEmail: string;
  artworkTitle: string;
  waitingCount: number;
};

export type EditionAlertCancelResult = "cancelled" | "already_stopped" | "not_found";

export interface EditionAlertStore {
  registerAlert(input: {
    artworkId: string;
    recipient: EditionAlertRecipient;
  }): Promise<"registered" | "already_subscribed">;
  /** Alerts still waiting for an edition, newest first. */
  listWaitingForSubject(identitySubjectId: string): Promise<EditionAlertReadModel[]>;
  cancelForSubject(input: {
    identitySubjectId: string;
    target: { alertId: string } | { artworkSlug: string };
    now: Date;
  }): Promise<EditionAlertCancelResult>;
  /** Null when the token matches no alert email. */
  previewUnsubscribe(token: string): Promise<EditionAlertUnsubscribePreviewModel | null>;
  /** Stops every waiting alert for the token's address and account. Null for an unknown token. */
  unsubscribe(token: string, now: Date): Promise<{ stopped: number } | null>;
}
