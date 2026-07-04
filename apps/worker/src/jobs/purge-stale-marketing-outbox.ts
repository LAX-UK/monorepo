import type { Logger } from "pino";
import type { IMarketingEventOutboxWorker } from "../interfaces/marketing-event-outbox.worker.js";

const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function purgeStaleMarketingOutbox(input: {
  marketingEventOutboxWorker: IMarketingEventOutboxWorker;
  log: Logger;
}): Promise<number> {
  const staleBefore = new Date(Date.now() - TERMINAL_RETENTION_MS);
  const count = await input.marketingEventOutboxWorker.purgeStaleTerminal(staleBefore);
  if (count > 0) {
    input.log.info({ count, staleBefore }, "purged stale marketing outbox rows");
  }
  return count;
}
