import { apiBaseUrl } from "@/lib/auth/api-base";
import { authSubmitFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { ForgotPasswordFormValues } from "@/lib/auth/schemas";

export type ForgotPasswordSubmitInput = ForgotPasswordFormValues & { turnstileToken?: string };

export async function forgotPasswordService(
  input: ForgotPasswordSubmitInput,
): Promise<AuthSubmitResult> {
  const res = await fetch(`${apiBaseUrl()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      ...(input.turnstileToken ? { turnstileToken: input.turnstileToken } : {}),
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    if (res.status === 429) {
      return authSubmitFailure("rate_limited");
    }
    if (payload.code === "captcha_required" || payload.code === "captcha_invalid") {
      return authSubmitFailure(
        payload.code === "captcha_required" ? "captcha_required" : "captcha_invalid",
      );
    }
    return authSubmitFailure("forgot_password_failed");
  }
  return { ok: true };
}
