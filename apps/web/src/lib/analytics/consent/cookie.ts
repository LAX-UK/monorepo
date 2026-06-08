export const CONSENT_COOKIE_NAME = "lax_consent";

export const CONSENT_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 180;

const CURRENT_VERSION = 1 as const;

export type ConsentSnapshotV1 = {
  v: typeof CURRENT_VERSION;
  /** ISO 8601 */
  ts: string;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

export type ConsentSnapshot = ConsentSnapshotV1;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/** Build a fresh snapshot with current timestamp. */
export function buildConsentSnapshot(prefs: {
  analytics: boolean;
  marketing: boolean;
}): ConsentSnapshotV1 {
  return {
    v: CURRENT_VERSION,
    ts: new Date().toISOString(),
    necessary: true,
    analytics: prefs.analytics,
    marketing: prefs.marketing,
  };
}

/** Parse cookie value; returns `null` if absent or invalid. */
export function parseConsentCookie(raw: string | undefined): ConsentSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const decoded = decodeURIComponent(raw.trim());
    const parsed: unknown = JSON.parse(decoded);
    if (!isRecord(parsed)) return null;
    const v = parsed.v;
    if (v === 1) {
      if (parsed.necessary !== true) return null;
      if (typeof parsed.analytics !== "boolean") return null;
      if (typeof parsed.marketing !== "boolean") return null;
      if (typeof parsed.ts !== "string" || !parsed.ts) return null;
      return {
        v: 1,
        ts: parsed.ts,
        necessary: true,
        analytics: parsed.analytics,
        marketing: parsed.marketing,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeConsent(snapshot: ConsentSnapshot): string {
  return encodeURIComponent(JSON.stringify(snapshot));
}
