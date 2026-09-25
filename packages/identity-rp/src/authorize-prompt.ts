/** Standard OAuth 2.0 / OIDC authorize `prompt` values used by LAX relying parties. */
export type OidcAuthorizePrompt = "login" | "create" | "none" | "consent";

export const OIDC_AUTHORIZE_PROMPTS: readonly OidcAuthorizePrompt[] = [
  "login",
  "create",
  "none",
  "consent",
] as const;

export function isOidcAuthorizePrompt(value: string): value is OidcAuthorizePrompt {
  return (OIDC_AUTHORIZE_PROMPTS as readonly string[]).includes(value);
}
