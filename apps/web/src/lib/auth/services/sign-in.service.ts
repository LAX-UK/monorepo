import { authClient } from "@/lib/auth-client";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { SignInFormValues } from "@/lib/auth/schemas";

export async function signInService(input: SignInFormValues): Promise<AuthSubmitResult> {
  const { error } = await authClient.signIn.email({
    email: input.email,
    password: input.password,
  });
  if (error) {
    return { ok: false, message: error.message ?? "Could not sign in" };
  }
  return { ok: true };
}
