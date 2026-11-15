import { createHmac, timingSafeEqual } from "node:crypto";

const KEY_LABEL = "lax:account-login-pending:v1";

/** How long a pending sign-in stays valid. The cookie Max-Age uses the same value. */
export const PENDING_LOGIN_MAX_AGE_SECONDS = 600;
/** Tolerated difference between the clocks that sealed and opened the value. */
const CLOCK_SKEW_SECONDS = 30;

function signingKey(secret: string): Buffer {
  // Derived under a fixed label so the key is never the session encryption key itself.
  return createHmac("sha256", secret).update(KEY_LABEL).digest();
}

function mac(key: Buffer, body: string): Buffer {
  return createHmac("sha256", key).update(body).digest();
}

/**
 * Wraps the pending sign-in (state, nonce, PKCE verifier, who a step-up is for) as
 * `<base64url payload>.<base64url HMAC-SHA256>`, so the browser cannot alter it. The payload
 * carries the time it was issued, so the value expires on its own and not only with the cookie.
 */
export function sealPendingLogin(json: string, secret: string, now: number = Date.now()): string {
  const envelope = JSON.stringify({ iat: Math.floor(now / 1000), pending: json });
  const body = Buffer.from(envelope, "utf8").toString("base64url");
  return `${body}.${mac(signingKey(secret), body).toString("base64url")}`;
}

/**
 * The pending sign-in JSON, or undefined when the value is missing, unsigned (including the
 * old plain-JSON cookie), altered, without an issued-at, or older than the allowed age. Callers treat undefined as an expired sign-in and restart it.
 */
export function openPendingLogin(
  value: string | undefined,
  secret: string,
  now: number = Date.now(),
): string | undefined {
  if (!value) return undefined;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot !== value.lastIndexOf(".")) return undefined;
  const body = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1), "base64url");
  const expected = mac(signingKey(secret), body);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  const issued = readEnvelope(Buffer.from(body, "base64url").toString("utf8"));
  if (!issued) return undefined;
  const age = Math.floor(now / 1000) - issued.iat;
  if (age > PENDING_LOGIN_MAX_AGE_SECONDS || age < -CLOCK_SKEW_SECONDS) return undefined;
  return issued.pending;
}

function readEnvelope(text: string): { iat: number; pending: string } | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const { iat, pending } = parsed as { iat?: unknown; pending?: unknown };
    if (typeof iat !== "number" || !Number.isFinite(iat) || typeof pending !== "string") {
      return undefined;
    }
    return { iat, pending };
  } catch {
    return undefined;
  }
}
