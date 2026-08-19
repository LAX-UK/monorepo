import type { Logger } from "pino";
import type { IIdentityOutboxRelayRepository } from "../interfaces/identity-outbox-relay.repository.js";

export async function runIdentityOutboxRelayJob(input: {
  identityOutboxRelayRepo: IIdentityOutboxRelayRepository;
  log: Logger;
}): Promise<{ relayed: number; cursor: number }> {
  const result = await input.identityOutboxRelayRepo.relayBatch();
  if (result.relayed > 0) {
    input.log.debug(
      { relayed: result.relayed, cursor: result.cursor },
      "identity outbox relay batch",
    );
  }
  return result;
}
