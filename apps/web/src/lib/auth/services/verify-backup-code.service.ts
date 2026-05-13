import { authClient } from "@/lib/auth-client";
import { authSubmitFailure, mapBetterAuthSecondaryFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

export async function verifyBackupCodeService(input: {
  code: string;
  trustDevice?: boolean;
}): Promise<AuthSubmitResult> {
  const res = await authClient.twoFactor.verifyBackupCode({
    code: input.code,
    ...(input.trustDevice !== undefined ? { trustDevice: input.trustDevice } : {}),
  });
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    const code = mapBetterAuthSecondaryFailure({
      rawCode,
      message: res.error.message,
      defaultCode: "backup_code_invalid",
    });
    return authSubmitFailure(code);
  }
  return { ok: true };
}
