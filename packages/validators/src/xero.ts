import { z } from "zod";

export const xeroOAuthCompleteBodySchema = z.object({
  state: z.string().min(1),
  /** Full URL the user landed on (origin + path + query), used by the Xero SDK token exchange. */
  callbackUrl: z.string().url(),
});

/** Ensure the browser-reported callback matches the configured redirect URI (path + origin). */
export function isXeroCallbackUrlAllowed(callbackUrl: string, allowedRedirect: string): boolean {
  let a: URL;
  let b: URL;
  try {
    a = new URL(callbackUrl);
    b = new URL(allowedRedirect);
  } catch {
    return false;
  }
  return a.origin === b.origin && a.pathname === b.pathname;
}
