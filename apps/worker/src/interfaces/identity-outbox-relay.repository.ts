export type IdentityOutboxRelayResult = {
  relayed: number;
  cursor: number;
};

/** One Identity outbox row as it was copied into the domain event log. */
export type RelayedIdentityEvent = {
  eventType: string;
  aggregateId: string;
  payload: unknown;
};

/**
 * Called with the batch while the relay's transaction is still open, before its cursor moves. If
 * it throws, the batch is rolled back and relayed again, so whatever it does must be safe to
 * repeat (the export job is keyed by the export id).
 */
export type IdentityOutboxRelayObserver = (
  events: readonly RelayedIdentityEvent[],
) => Promise<void>;

export type IIdentityOutboxRelayRepository = {
  relayBatch(observer?: IdentityOutboxRelayObserver): Promise<IdentityOutboxRelayResult>;
};
