import { apiBaseUrl } from "@/lib/auth/api-base";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { ForgotPasswordFormValues } from "@/lib/auth/schemas";

export async function forgotPasswordService(
  input: ForgotPasswordFormValues,
): Promise<AuthSubmitResult> {
  const res = await fetch(`${apiBaseUrl()}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: input.email }),
  });
  if (!res.ok) {
    return { ok: false, message: "Something went wrong. Please try again." };
  }
  return { ok: true };
}
