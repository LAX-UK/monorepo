export type VisitorSaleAlertStatus = "pending" | "confirmed" | "unsubscribed";

export type VisitorSaleAlertRecord = {
  id: string;
  email: string;
  status: VisitorSaleAlertStatus;
  requestedAt: Date;
  confirmationSentAt: Date | null;
  linkedUserId: string | null;
};

export interface IVisitorSaleAlertRepository {
  findByEmail(email: string): Promise<VisitorSaleAlertRecord | null>;
  findById(id: string): Promise<VisitorSaleAlertRecord | null>;
  /**
   * Starts (or restarts) a double opt-in request: the row becomes `pending` with this consent
   * record and a new `requestedAt`. Safe under concurrent requests for the same address.
   */
  savePending(input: {
    email: string;
    consentText: string;
    consentSource: string;
    now: Date;
  }): Promise<VisitorSaleAlertRecord>;
  /** Confirms a row that is still pending. Returns false when it no longer is. */
  confirm(id: string, now: Date): Promise<boolean>;
  unsubscribe(id: string, now: Date): Promise<void>;
  linkUser(id: string, userId: string, now: Date): Promise<void>;
}
