import type { Logger } from "pino";
import type { IMarketingAttributionPurgeRepository } from "../interfaces/marketing-attribution-purge.repository.js";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function purgeStaleMarketingAttribution(input: {
  marketingAttributionPurgeRepo: IMarketingAttributionPurgeRepository;
  log: Logger;
}): Promise<number> {
  const staleBefore = new Date(Date.now() - RETENTION_MS);
  const count = await input.marketingAttributionPurgeRepo.purgeStale(staleBefore);
  if (count > 0) {
    input.log.info({ count, staleBefore }, "purged stale marketing attribution snapshots");
  }
  return count;
}
