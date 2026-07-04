import type { Logger } from "pino";
import type { IUserPiiPurgeRepository } from "../interfaces/user-pii-purge.repository.js";

/**
 * GDPR / data-retention purge after account deletion cooling-off.
 *
 * Selects users who requested deletion more than `graceDays` ago and invokes
 * {@link user_pii_purge} (migration `0058_user_pii_purge.sql`) per row.
 */
export async function purgeSoftDeletedUsers(
  userPiiPurgeRepo: IUserPiiPurgeRepository,
  options: {
    graceDays?: number;
    batchLimit?: number;
    log?: Logger;
    onPurgeUser?: (userId: string) => Promise<void>;
  },
): Promise<{ processed: number }> {
  const graceDays = options.graceDays ?? 30;
  const limit = options.batchLimit ?? 100;

  const candidates = await userPiiPurgeRepo.listDeletionCandidates(graceDays, limit);

  let processed = 0;
  for (const userId of candidates) {
    try {
      if (options.onPurgeUser) {
        await options.onPurgeUser(userId);
      } else {
        await userPiiPurgeRepo.purgeUser(userId);
      }
      processed++;
    } catch (err) {
      options.log?.error(
        { userId, error: err instanceof Error ? err.message : String(err) },
        "purge-soft-deleted-users: failed to purge user",
      );
    }
  }

  options.log?.info({ processed }, "purge-soft-deleted-users: complete");
  return { processed };
}
