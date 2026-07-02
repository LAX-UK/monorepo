import { apiBaseUrl } from "@/lib/auth/api-base";
import { authSubmitFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { SignUpFormValues } from "@/lib/auth/schemas";

/** Omit optional Turnstile field from the form model so callers can attach a concrete token. */
export type SignUpSubmitInput = Omit<SignUpFormValues, "turnstileToken"> & {
  turnstileToken?: string;
};

export async function signUpService(input: SignUpSubmitInput): Promise<AuthSubmitResult> {
  const { acceptTerms: _acceptTerms, ...body } = input;
  const res = await fetch(`${apiBaseUrl()}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    if (payload.code === "captcha_required" || payload.code === "captcha_invalid") {
      return authSubmitFailure(
        payload.code === "captcha_required" ? "captcha_required" : "captcha_invalid",
      );
    }
    if (payload.code === "registration_disabled") {
      return authSubmitFailure("registration_disabled");
    }
    if (payload.code === "email_already_registered") {
      return authSubmitFailure("email_already_registered");
    }
    if (
      res.status === 400 &&
      typeof payload.error === "string" &&
      payload.error.trim().length > 0
    ) {
      return authSubmitFailure("registration_validation", {
        registrationDetail: payload.error,
      });
    }
    return authSubmitFailure("registration_failed");
  }
  return { ok: true };
}
