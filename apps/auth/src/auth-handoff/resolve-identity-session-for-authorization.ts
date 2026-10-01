const SESSION_TOKEN_RE = /(?:__Secure-)?better-auth\.session_token=/;
const SESSION_DATA_RE = /(?:__Secure-)?better-auth\.session_data=/;
const DONT_REMEMBER_RE = /(?:__Secure-)?better-auth\.dont_remember=/;

const STRIP_COOKIE_NAME_RES =
  /^(?:__Secure-)?better-auth\.(session_token|session_data|dont_remember)$/;

export function hasBetterAuthSessionCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return (
    SESSION_TOKEN_RE.test(cookieHeader) ||
    SESSION_DATA_RE.test(cookieHeader) ||
    DONT_REMEMBER_RE.test(cookieHeader)
  );
}

function parseCookiePair(segment: string): { name: string; value: string } | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  return { name: trimmed.slice(0, eq).trim(), value: trimmed.slice(eq + 1).trim() };
}

function stripBetterAuthSessionCookies(cookieHeader: string): {
  header: string;
  stripped: boolean;
} {
  const parts = cookieHeader
    .split(";")
    .map((part) => parseCookiePair(part))
    .filter((part): part is { name: string; value: string } => part !== null);
  const kept = parts.filter((part) => !STRIP_COOKIE_NAME_RES.test(part.name));
  if (kept.length === parts.length) {
    return { header: cookieHeader, stripped: false };
  }
  return {
    header: kept.map((part) => `${part.name}=${part.value}`).join("; "),
    stripped: true,
  };
}

function extractSetCookiePair(setCookieHeader: string): { name: string; value: string } | null {
  const nameValue = setCookieHeader.split(";")[0]?.trim() ?? "";
  const parsed = parseCookiePair(nameValue);
  if (!parsed || !STRIP_COOKIE_NAME_RES.test(parsed.name)) return null;
  return parsed;
}

export function buildSessionLookupCookieHeader(
  requestHeaders: Headers,
  setCookieHeaders: string[],
): {
  headers: Headers;
  hadIncomingSessionCookie: boolean;
  hadResponseSessionCookie: boolean;
  strippedStale: boolean;
  sessionSource: "fresh" | "incoming" | "none";
} {
  const sessionHeaders = new Headers(requestHeaders);
  const incoming = sessionHeaders.get("cookie") ?? "";
  const hadIncomingSessionCookie = hasBetterAuthSessionCookie(incoming);

  const freshPairs: { name: string; value: string }[] = [];
  for (const setCookie of setCookieHeaders) {
    const pair = extractSetCookiePair(setCookie);
    if (pair) freshPairs.push(pair);
  }

  const hadResponseSessionCookie = freshPairs.some((pair) =>
    SESSION_TOKEN_RE.test(`${pair.name}=`),
  );

  if (freshPairs.length === 0) {
    return {
      headers: sessionHeaders,
      hadIncomingSessionCookie,
      hadResponseSessionCookie: false,
      strippedStale: false,
      sessionSource: hadIncomingSessionCookie ? "incoming" : "none",
    };
  }

  const { header: strippedIncoming, stripped } = stripBetterAuthSessionCookies(incoming);
  const merged = new Map<string, string>();
  for (const part of strippedIncoming.split(";")) {
    const parsed = parseCookiePair(part);
    if (parsed) merged.set(parsed.name, parsed.value);
  }
  for (const pair of freshPairs) {
    merged.set(pair.name, pair.value);
  }
  const cookieHeader = [...merged.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  if (cookieHeader) {
    sessionHeaders.set("cookie", cookieHeader);
  } else {
    sessionHeaders.delete("cookie");
  }

  return {
    headers: sessionHeaders,
    hadIncomingSessionCookie,
    hadResponseSessionCookie,
    strippedStale: stripped || hadIncomingSessionCookie,
    sessionSource: "fresh",
  };
}

export type GetSessionResult = { session?: { id?: string } | null } | null;

export async function resolveIdentitySessionForAuthorization(input: {
  getSession: (headers: Headers) => Promise<GetSessionResult>;
  requestHeaders: Headers;
  setCookieHeaders: string[];
}): Promise<{
  identitySessionId: string | null;
  hadIncomingSessionCookie: boolean;
  hadResponseSessionCookie: boolean;
  strippedStale: boolean;
  sessionSource: "fresh" | "incoming" | "none";
}> {
  const built = buildSessionLookupCookieHeader(input.requestHeaders, input.setCookieHeaders);
  const codeSession = await input.getSession(built.headers);
  const identitySessionId = codeSession?.session?.id ?? null;
  return {
    identitySessionId,
    hadIncomingSessionCookie: built.hadIncomingSessionCookie,
    hadResponseSessionCookie: built.hadResponseSessionCookie,
    strippedStale: built.strippedStale,
    sessionSource: built.sessionSource,
  };
}
