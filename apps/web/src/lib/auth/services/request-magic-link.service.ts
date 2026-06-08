import { getAuthIssuerBaseUrl } from "@/lib/auth-client";
import { authSubmitFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";

export type RequestMagicLinkInput = {
  email: string;
  turnstileToken?: string;
  webOrigin: string;
};

export async function requestMagicLinkService(
  input: RequestMagicLinkInput,
): Promise<AuthSubmitResult> {
  const authBase = getAuthIssuerBaseUrl().replace(/\/$/, "");
  const webBase = input.webOrigin.replace(/\/$/, "");
  const res = await fetch(`${authBase}/api/auth/sign-in/magic-link`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      callbackURL: `${webBase}/auth/activate/set-password`,
      errorCallbackURL: `${webBase}/auth/activate/expired`,
      ...(input.turnstileToken ? { turnstileToken: input.turnstileToken } : {}),
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    if (res.status === 429) return authSubmitFailure("rate_limited");
    if (payload.code === "captcha_required" || payload.code === "captcha_invalid") {
      return authSubmitFailure(
        payload.code === "captcha_required" ? "captcha_required" : "captcha_invalid",
      );
    }
    return authSubmitFailure("magic_link_request_failed");
  }
  return { ok: true };
}
