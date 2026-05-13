import { authClient } from "@/lib/auth-client";
import {
  type AuthErrorCode,
  authSubmitFailure,
  mapBetterAuthSecondaryFailure,
} from "@/lib/auth/auth-error-code";
import { notifyTwoFactorEnabledEmail } from "@/lib/auth/security-notify.client";

export type EnableTwoFactorResult =
  | { ok: true; totpURI: string; backupCodes: string[] }
  | { ok: false; code: AuthErrorCode; message: string };

export async function enableTwoFactorService(password: string): Promise<EnableTwoFactorResult> {
  const res = await authClient.twoFactor.enable({ password });
  if (res.error) {
    const rawCode =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    const code = mapBetterAuthSecondaryFailure({
      rawCode,
      message: res.error.message,
      defaultCode: "two_factor_enable_failed",
    });
    return authSubmitFailure(code);
  }
  const totpURI = res.data?.totpURI;
  const backupCodes = res.data?.backupCodes;
  if (typeof totpURI !== "string" || !Array.isArray(backupCodes)) {
    return authSubmitFailure("two_factor_unexpected_response");
  }
  notifyTwoFactorEnabledEmail();
  return { ok: true, totpURI, backupCodes };
}
