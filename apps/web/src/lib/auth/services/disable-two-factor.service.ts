import { authClient } from "@/lib/auth-client";
import { authSubmitFailure, mapBetterAuthSecondaryFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import { notifyTwoFactorDisabledEmail } from "@/lib/auth/security-notify.client";

export async function disableTwoFactorService(password?: string): Promise<AuthSubmitResult> {
  const res = await authClient.twoFactor.disable(
    password != null && password.length > 0 ? { password } : {},
  );
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    const code = mapBetterAuthSecondaryFailure({
      rawCode,
      message: res.error.message,
      defaultCode: "two_factor_disable_failed",
    });
    return authSubmitFailure(code);
  }
  notifyTwoFactorDisabledEmail();
  return { ok: true };
}
