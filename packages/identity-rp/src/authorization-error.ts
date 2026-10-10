/** Stable reason codes for OAuth authorize/callback error query params. */
export type AuthorizationCallbackReason =
  | "mfa_required"
  | "access_denied"
  | "login_required"
  | "auth_failed";

/**
 * Maps OIDC error responses from the authorization endpoint to stable app reason codes.
 * Returns null when `error` is absent (caller may still lack `code`).
 */
export function classifyAuthorizationError(input: {
  error: string | null;
  errorDescription: string | null;
}): AuthorizationCallbackReason | null {
  const raw = input.error?.trim();
  if (!raw) return null;

  const err = raw.toLowerCase();
  if (err === "access_denied") return "access_denied";
  if (err === "unmet_authentication_requirements") return "mfa_required";
  if (err === "login_required") {
    const desc = (input.errorDescription ?? "").toLowerCase();
    if (desc.includes("silver") || desc.includes("acr")) return "mfa_required";
    return "login_required";
  }
  return "auth_failed";
}
