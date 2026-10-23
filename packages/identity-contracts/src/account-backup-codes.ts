import { z } from "zod";

/** Issuer route LAX Account calls (under the Better Auth base path) to replace the backup codes. */
export const ACCOUNT_BACKUP_CODES_REGENERATE_PATH = "/lax/account-backup-codes/regenerate";

/**
 * The new codes, in the only response that ever carries them. The issuer keeps them encrypted
 * and never reveals them again, so a caller that loses this response must regenerate.
 */
export const accountBackupCodesSchema = z.object({
  backupCodes: z.array(z.string().min(1)).min(1),
});

export type AccountBackupCodesResponse = z.infer<typeof accountBackupCodesSchema>;
