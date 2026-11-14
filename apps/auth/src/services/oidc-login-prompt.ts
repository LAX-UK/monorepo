import { parse } from "hono/utils/cookie";

/** Better Auth's OIDC provider keeps the authorize request here while a sign-in is needed. */
const LOGIN_PROMPT_COOKIE = "oidc_login_prompt";
/** A base64 HMAC-SHA256, the only signature Better Auth writes. */
const SIGNATURE_LENGTH = 44;

/**
 * Reads the authorize request the OIDC provider kept for the sign-in page, or null.
 *
 * When the browser already holds a session, the provider sends a `prompt=login` or `max_age`
 * request to its sign-in page with only `client_id`, `code` and `state`: `prompt` and Account's
 * reason survive only in this cookie. The provider signs it with the issuer secret, so the value
 * is used only when that signature checks out; a cookie set or edited in the browser is ignored.
 * Only string values are kept; the hosted pages then read just the authorize parameters they know.
 */
export type OidcLoginPromptReader = (headers: Headers) => Promise<URLSearchParams | null>;

export function createOidcLoginPromptReader(
  readSecret: () => Promise<string> | string,
): OidcLoginPromptReader {
  return async (headers) => {
    const cookie = headers.get("cookie");
    if (!cookie) return null;
    const signed = parse(cookie, LOGIN_PROMPT_COOKIE)[LOGIN_PROMPT_COOKIE];
    if (!signed) return null;
    const separator = signed.lastIndexOf(".");
    if (separator < 1) return null;
    const value = signed.slice(0, separator);
    const signature = signed.slice(separator + 1);
    if (signature.length !== SIGNATURE_LENGTH || !signature.endsWith("=")) return null;
    if (!(await signatureMatches(value, signature, await readSecret()))) return null;
    return authorizeParams(value);
  };
}

async function signatureMatches(value: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  let expected: Uint8Array;
  try {
    expected = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
  } catch {
    return false;
  }
  return crypto.subtle.verify("HMAC", key, expected, encoder.encode(value));
}

function authorizeParams(value: string): URLSearchParams | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const params = new URLSearchParams();
  for (const [key, entry] of Object.entries(parsed)) {
    if (typeof entry === "string" && entry.length > 0) params.set(key, entry);
  }
  return params;
}
