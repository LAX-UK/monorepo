import { getAuthIssuerBaseUrl } from "@/lib/auth-client";
import { authSubmitFailure, mapBetterAuthClientFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { SignInFormValues } from "@/lib/auth/schemas";

export type SignInServiceInput = SignInFormValues & { turnstileToken?: string | undefined };

export async function signInService(input: SignInServiceInput): Promise<AuthSubmitResult> {
  const base = getAuthIssuerBaseUrl();
  const res = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      ...(input.turnstileToken ? { turnstileToken: input.turnstileToken } : {}),
    }),
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const body = json as Record<string, unknown> | null;

  if (body && typeof body === "object" && body.code === "captcha_required") {
    return authSubmitFailure("captcha_required");
  }
  if (body && typeof body === "object" && body.code === "captcha_invalid") {
    return authSubmitFailure("captcha_invalid");
  }

  if (!res.ok) {
    // Better Auth can return either `{code, message}` (top-level) or
    // `{error: {code, message}}` (nested) depending on the plugin and version.
    const nested = body?.error;
    const rawCode =
      typeof body?.code === "string"
        ? body.code
        : typeof nested === "object" &&
            nested !== null &&
            typeof (nested as Record<string, unknown>).code === "string"
          ? ((nested as Record<string, unknown>).code as string)
          : undefined;
    const message =
      typeof body?.message === "string"
        ? body.message
        : typeof nested === "object" &&
            nested !== null &&
            typeof (nested as Record<string, unknown>).message === "string"
          ? ((nested as Record<string, unknown>).message as string)
          : undefined;
    const code = mapBetterAuthClientFailure({ rawCode, message });
    return authSubmitFailure(code);
  }

  const data = body as {
    twoFactorRedirect?: boolean;
    twoFactorMethods?: string[];
  } | null;
  const redirect = Boolean(data?.twoFactorRedirect);
  if (redirect) {
    const methods = data?.twoFactorMethods;
    return {
      ok: true,
      requiresTwoFactor: true,
      ...(Array.isArray(methods) ? { twoFactorMethods: methods } : {}),
    };
  }
  return { ok: true };
}
