import type { Logger } from "pino";
import type {
  IIdentityOutboxRelayRepository,
  IdentityOutboxRelayObserver,
} from "../interfaces/identity-outbox-relay.repository.js";

export async function runIdentityOutboxRelayJob(input: {
  identityOutboxRelayRepo: IIdentityOutboxRelayRepository;
  log: Logger;
  /** Reacts to the batch inside the relay's transaction; see {@link IdentityOutboxRelayObserver}. */
  observer?: IdentityOutboxRelayObserver;
}): Promise<{ relayed: number; cursor: number }> {
  const result = await input.identityOutboxRelayRepo.relayBatch(input.observer);
  if (result.relayed > 0) {
    input.log.debug(
      { relayed: result.relayed, cursor: result.cursor },
      "identity outbox relay batch",
    );
  }
  return result;
}
