/** Read GA4 browser identifiers under analytics consent for server-event stitching. */

export type Ga4BrowserIds = {
  clientId: string;
  sessionId?: string;
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function parseGaClientId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const parts = raw.trim().split(".");
  if (parts.length >= 4 && parts[0] === "GA1" && /^\d+$/.test(parts[2] ?? "")) {
    const clientId = `${parts[2]}.${parts[3]}`;
    return /^\d{1,20}\.\d{1,20}$/.test(clientId) ? clientId : null;
  }
  const trimmed = raw.trim();
  return /^\d{1,20}\.\d{1,20}$/.test(trimmed) ? trimmed : null;
}

/** Supports both legacy GS1 and current self-describing GS2 session cookies. */
export function parseGaSessionId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const decoded = raw.trim().replace(/%24/gi, "$");
  if (decoded.startsWith("GS2.")) {
    const payload = decoded.split(".").slice(2).join(".");
    const session = payload
      .split("$")
      .find((part) => /^s\d{1,20}$/.test(part))
      ?.slice(1);
    return session ?? null;
  }
  const parts = decoded.split(".");
  const session = parts[0] === "GS1" && parts.length >= 3 ? parts[2] : null;
  return session && /^\d{1,20}$/.test(session) ? session : null;
}

function measurementCookieSuffix(): string | null {
  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID?.trim();
  if (!measurementId?.startsWith("G-")) return null;
  const suffix = measurementId.slice(2).replace(/[^A-Z0-9]/gi, "");
  return suffix || null;
}

export function readGa4BrowserIdsFromDocument(): Ga4BrowserIds | null {
  const clientId = parseGaClientId(readCookie("_ga"));
  if (!clientId) return null;
  const suffix = measurementCookieSuffix();
  const sessionId = suffix ? parseGaSessionId(readCookie(`_ga_${suffix}`)) : null;
  return sessionId ? { clientId, sessionId } : { clientId };
}

export function serializeGa4BrowserIdsHeader(ids: Ga4BrowserIds | null): string | null {
  if (!ids) return null;
  const serialized = JSON.stringify(ids);
  return serialized.length <= 256 ? serialized : null;
}
