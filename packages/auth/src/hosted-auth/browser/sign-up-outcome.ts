export type SignUpOutcome = "check-email" | "generic-error" | "created" | "password-breached";

export const PASSWORD_BREACHED_CODE = "PASSWORD_BREACHED";

/** The breach check runs before any account lookup, so naming it reveals nothing about the email. */
export function isPasswordBreachedResponse(status: number, data: unknown): boolean {
  if (status !== 400 || !data || typeof data !== "object") return false;
  return (data as { code?: unknown }).code === PASSWORD_BREACHED_CODE;
}

export function signUpOutcome(input: {
  requireEmailVerification: boolean;
  status: number;
  data?: unknown;
}): SignUpOutcome {
  if (isPasswordBreachedResponse(input.status, input.data)) return "password-breached";
  const clientError = input.status >= 400 && input.status < 500;
  const success = input.status >= 200 && input.status < 300;
  if (input.requireEmailVerification && (clientError || success)) {
    return "check-email";
  }
  if (success) return "created";
  return "generic-error";
}
