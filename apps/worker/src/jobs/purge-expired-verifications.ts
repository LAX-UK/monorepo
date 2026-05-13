import type { createDb } from "@auction/db";
import { verification } from "@auction/db/schema";
import { lt } from "drizzle-orm";
import type { Logger } from "pino";

type Db = ReturnType<typeof createDb>;

/**
 * Deletes rows from `verification` where `expires_at < cutoff`.
 * Better Auth leaves stale email-verify / password-reset tokens behind
 * indefinitely; this sweeper removes them to keep the table lean.
 */
export async function purgeExpiredVerifications(
  db: Db,
  options: { cutoff?: Date; log?: Logger },
): Promise<{ deleted: number }> {
  const cutoff = options.cutoff ?? new Date();

  const deleted = await db
    .delete(verification)
    .where(lt(verification.expiresAt, cutoff))
    .returning({ id: verification.id });

  const count = deleted.length;
  if (count > 0) {
    options.log?.info({ count, cutoff }, "purge-expired-verifications: rows deleted");
  }
  return { deleted: count };
}
