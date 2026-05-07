/** structured acting-legal-entity cookie (v1).
 * Legacy plain UUID values are still accepted for standard acting context.
 * Impersonation cookies carry only a server-side session id; timestamps are
 * deliberately not trusted from the client.
 */

/** Cookie name shared by web + API (must match legacy `client-acting-context`). */
export const ACTING_LEGAL_ENTITY_COOKIE_NAME = "lax_acting_legal_entity_id";

export const IMPERSONATION_TTL_MS = 4 * 60 * 60 * 1000;

export type ActingContextCookieV1 = {
  v: 1;
  /** Acting legal entity id */
  e: string;
  /** Display name snapshot (impersonation banner / title) */
  n?: string;
  /** Impersonation session — absent when member is acting on their own entity */
  i?: {
    /** session id (uuid) */
    sid: string;
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidString(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function encodeActingContextCookie(payload: ActingContextCookieV1): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeActingContextCookie(raw: string | undefined | null): ActingContextCookieV1 | null {
  if (raw == null || raw === "") return null;
  const trimmed = raw.trim();
  if (isUuidString(trimmed)) {
    return { v: 1, e: trimmed };
  }
  try {
    const json = JSON.parse(Buffer.from(trimmed, "base64url").toString("utf8")) as ActingContextCookieV1;
    if (json?.v === 1 && typeof json.e === "string" && isUuidString(json.e)) {
      if (json.i !== undefined) {
        if (typeof json.i?.sid !== "string" || !isUuidString(json.i.sid)) return null;
      }
      return json;
    }
  } catch {
    return null;
  }
  return null;
}

export function impersonationExpiresAt(payload: ActingContextCookieV1): Date | null {
  void payload;
  return null;
}

export function isImpersonationExpired(payload: ActingContextCookieV1, nowMs = Date.now()): boolean {
  const exp = impersonationExpiresAt(payload);
  if (!exp) return false;
  return nowMs > exp.getTime();
}
