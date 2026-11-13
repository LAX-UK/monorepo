import { createHmac, timingSafeEqual } from "node:crypto";

const KEY_LABEL = "lax:account-login-pending:v1";

function signingKey(secret: string): Buffer {
  // Derived under a fixed label so the key is never the session encryption key itself.
  return createHmac("sha256", secret).update(KEY_LABEL).digest();
}

function mac(key: Buffer, body: string): Buffer {
  return createHmac("sha256", key).update(body).digest();
}

/**
 * Wraps the pending sign-in (state, nonce, PKCE verifier, who a step-up is for) as
 * `<base64url payload>.<base64url HMAC-SHA256>`, so the browser cannot alter it.
 */
export function sealPendingLogin(json: string, secret: string): string {
  const body = Buffer.from(json, "utf8").toString("base64url");
  return `${body}.${mac(signingKey(secret), body).toString("base64url")}`;
}

/**
 * The pending sign-in JSON, or undefined when the value is missing, unsigned (including the
 * old plain-JSON cookie) or altered. Callers treat undefined as an expired sign-in and restart it.
 */
export function openPendingLogin(value: string | undefined, secret: string): string | undefined {
  if (!value) return undefined;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot !== value.lastIndexOf(".")) return undefined;
  const body = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), "base64url");
  const expected = mac(signingKey(secret), body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  return Buffer.from(body, "base64url").toString("utf8");
}
