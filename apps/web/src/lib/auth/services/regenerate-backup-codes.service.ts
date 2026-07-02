import { authClient } from "@/lib/auth-client";
import {
  type AuthErrorCode,
  authSubmitFailure,
  mapBetterAuthSecondaryFailure,
} from "@/lib/auth/auth-error-code";

export type RegenerateBackupCodesResult =
  | { ok: true; backupCodes: string[] }
  | { ok: false; code: AuthErrorCode; message: string };

export async function regenerateBackupCodesService(
  password?: string,
): Promise<RegenerateBackupCodesResult> {
  const res = await authClient.twoFactor.generateBackupCodes(
    password != null && password.length > 0 ? { password } : {},
  );
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    const code = mapBetterAuthSecondaryFailure({
      rawCode,
      message: res.error.message,
      defaultCode: "two_factor_backup_regenerate_failed",
    });
    return authSubmitFailure(code);
  }
  const backupCodes = res.data?.backupCodes;
  if (!Array.isArray(backupCodes)) {
    return authSubmitFailure("two_factor_unexpected_response");
  }
  return { ok: true, backupCodes };
}
