import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { generateRandomString, symmetricEncrypt } from "better-auth/crypto";
import { z } from "zod";

type SecretConfig = Parameters<typeof symmetricEncrypt>[0]["key"];

/** Better Auth's defaults for the two-factor plugin: ten codes of ten characters, shown as 5-5. */
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;

/**
 * A new set of backup codes and the value to store, made exactly as the two-factor plugin makes
 * them. Better Auth does not export its own generator at runtime (only in its type declarations),
 * so this mirrors it: same alphabet, same `xxxxx-xxxxx` shape and the same encryption of the JSON
 * list under the server secret (`storeBackupCodes: "encrypted"`, the plugin's default), which is
 * what `verifyBackupCode` and `viewBackupCodes` read back. A test decrypts the result with
 * Better Auth's own `symmetricDecrypt` so a change in the plugin's storage fails loudly.
 */
export async function createBackupCodes(
  secret: SecretConfig,
): Promise<{ backupCodes: string[]; encryptedBackupCodes: string }> {
  const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const code = generateRandomString(BACKUP_CODE_LENGTH, "a-z", "0-9", "A-Z");
    return `${code.slice(0, 5)}-${code.slice(5)}`;
  });
  return {
    backupCodes,
    encryptedBackupCodes: await symmetricEncrypt({
      data: JSON.stringify(backupCodes),
      key: secret,
    }),
  };
}

/**
 * Server-only counterpart of Better Auth's `/two-factor/generate-backup-codes`, for LAX Account.
 *
 * The stock endpoint authenticates with the issuer's browser cookie and the person's password.
 * LAX Account holds neither: it acts for a person with its own client credentials, and the issuer
 * route in front of this proves a recent sign-in instead. This endpoint has no HTTP route, so it
 * cannot be reached except through that route.
 *
 * Codes are stored through Better Auth's own database adapter, so the at-rest envelope applies.
 * Returns null when the person has no two-step verification to regenerate codes for.
 */
export function buildRegenerateBackupCodesPlugin(): BetterAuthPlugin {
  return {
    id: "lax-regenerate-backup-codes",
    endpoints: {
      regenerateBackupCodes: createAuthEndpoint.serverOnly(
        { method: "POST", body: z.object({ userId: z.string().min(1) }) },
        async (ctx) => {
          const user = await ctx.context.internalAdapter.findUserById(ctx.body.userId);
          // `twoFactorEnabled` is a field the two-factor plugin adds to the user.
          const enabled = (user as { twoFactorEnabled?: boolean | null } | null)?.twoFactorEnabled;
          const twoFactor = enabled
            ? await ctx.context.adapter.findOne<{ id: string }>({
                model: "twoFactor",
                where: [{ field: "userId", value: ctx.body.userId }],
              })
            : null;
          if (!twoFactor) return ctx.json({ backupCodes: null });
          const { backupCodes, encryptedBackupCodes } = await createBackupCodes(
            ctx.context.secretConfig,
          );
          await ctx.context.adapter.update({
            model: "twoFactor",
            update: { backupCodes: encryptedBackupCodes },
            where: [{ field: "id", value: twoFactor.id }],
          });
          return ctx.json({ backupCodes });
        },
      ),
    },
  };
}
