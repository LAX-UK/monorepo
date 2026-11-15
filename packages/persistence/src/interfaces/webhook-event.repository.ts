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

  /**
   * Unprocessed rows with no active lease, for defensive drain. `excludeSources` leaves those
   * sources out, so rows a worker is deliberately holding back do not fill the batch.
   */
  listUnprocessedForDrain(
    limit: number,
    options?: { excludeSources?: readonly string[] },
  ): Promise<WebhookEventDrainRow[]>;

  /**
   * Gives back a lease taken with `tryClaimForProcessing` without processing the row: the row
   * stays unprocessed and the attempt is not counted, so holding a row back never uses it up.
   */
  releaseClaim(eventKey: string): Promise<void>;

  /** Release leases that expired without completion. */
  recoverStaleClaims(now?: Date): Promise<number>;

  markProcessed(eventKey: string): Promise<void>;
  markFailed(eventKey: string, error: string): Promise<void>;
}
