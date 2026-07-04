import type { Logger } from "pino";
import type { IMarketingClickIdPurgeRepository } from "../interfaces/marketing-click-id-purge.repository.js";

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function purgeStaleMarketingClickIds(input: {
  marketingClickIdPurgeRepo: IMarketingClickIdPurgeRepository;
  log: Logger;
}): Promise<number> {
  const staleBefore = new Date(Date.now() - RETENTION_MS);
  const count = await input.marketingClickIdPurgeRepo.purgeStale(staleBefore);
  if (count > 0) {
    input.log.info({ count, staleBefore }, "purged stale marketing click ids");
  }
  return count;
}
