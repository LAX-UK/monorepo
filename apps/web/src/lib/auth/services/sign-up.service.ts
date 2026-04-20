import { apiBaseUrl } from "@/lib/auth/api-base";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { SignUpFormValues } from "@/lib/auth/schemas";

export async function signUpService(input: SignUpFormValues): Promise<AuthSubmitResult> {
  const { acceptTerms: _acceptTerms, ...body } = input;
  const res = await fetch(`${apiBaseUrl()}/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, message: payload.error ?? "Could not register" };
  }
  return { ok: true };
}
