import { authClient } from "@/lib/auth-client";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

export async function disableTwoFactorService(password: string): Promise<AuthSubmitResult> {
  const res = await authClient.twoFactor.disable({ password });
  if (res.error) {
    const code =
      "code" in res.error && typeof res.error.code === "string" ? res.error.code : undefined;
    return {
      ok: false,
      message: res.error.message ?? "Could not disable two-factor authentication",
      ...(code ? { code } : {}),
    };
  }
  return { ok: true };
}
