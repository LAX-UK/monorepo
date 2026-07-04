import type { Logger } from "pino";
import type { IVerificationPurgeRepository } from "../interfaces/verification-purge.repository.js";

/**
 * Deletes rows from `verification` where `expires_at < cutoff`.
 * Better Auth leaves stale email-verify / password-reset tokens behind
 * indefinitely; this sweeper removes them to keep the table lean.
 */
export async function purgeExpiredVerifications(
  verificationPurgeRepo: IVerificationPurgeRepository,
  options: { cutoff?: Date; log?: Logger },
): Promise<{ deleted: number }> {
  const cutoff = options.cutoff ?? new Date();
  const { deleted } = await verificationPurgeRepo.purgeBefore(cutoff);

  if (deleted > 0) {
    options.log?.info({ count: deleted, cutoff }, "purge-expired-verifications: rows deleted");
  }
  return { deleted };
}
