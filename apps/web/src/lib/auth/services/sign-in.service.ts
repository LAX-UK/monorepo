import { authClient } from "@/lib/auth-client";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { SignInFormValues } from "@/lib/auth/schemas";

export async function signInService(input: SignInFormValues): Promise<AuthSubmitResult> {
  const { data, error } = await authClient.signIn.email({
    email: input.email,
    password: input.password,
  });
  if (error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : undefined;
    return {
      ok: false,
      message: error.message ?? "Could not sign in",
      ...(code ? { code } : {}),
    };
  }
  const redirect =
    data &&
    typeof data === "object" &&
    "twoFactorRedirect" in data &&
    Boolean((data as { twoFactorRedirect?: boolean }).twoFactorRedirect);
  if (redirect) {
    const methods = (data as { twoFactorMethods?: string[] }).twoFactorMethods;
    return {
      ok: true,
      requiresTwoFactor: true,
      ...(Array.isArray(methods) ? { twoFactorMethods: methods } : {}),
    };
  }
  return { ok: true };
}
