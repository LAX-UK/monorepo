export interface IWebhookEventRepository {
  /** Attempt to claim an event by inserting with unique event_key.
   * Returns `{ claimed: true }` if this call inserted the row (first arrival),
   * or `{ claimed: false }` if the event_key already exists (duplicate).
   */
  tryClaimEvent(input: {
    source: string;
    eventKey: string;
    payload: unknown;
  }): Promise<{ claimed: boolean }>;

  markProcessed(eventKey: string): Promise<void>;
  markFailed(eventKey: string, error: string): Promise<void>;
}
