export type WebhookEventDrainRow = {
  eventKey: string;
  source: string;
  payload: unknown;
  attempts: number;
};

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

  /** Lease a row for worker processing (increments attempts). */
  tryClaimForProcessing(
    eventKey: string,
    leaseMs: number,
  ): Promise<{ claimed: boolean; row: WebhookEventDrainRow | null }>;

  /** Unprocessed rows with no active lease, for defensive drain. */
  listUnprocessedForDrain(limit: number): Promise<WebhookEventDrainRow[]>;

  /** Release leases that expired without completion. */
  recoverStaleClaims(now?: Date): Promise<number>;

  markProcessed(eventKey: string): Promise<void>;
  markFailed(eventKey: string, error: string): Promise<void>;
}
