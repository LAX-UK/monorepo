const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "code",
  "session",
  "session_id",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "invite",
  "invite_token",
  "reset",
  "key",
  "auth",
  "jwt",
]);

const MAX_PAGE_URL_LENGTH = 2048;

/** Strip query/fragment and known sensitive params; cap length for API headers. */
export function sanitizePageUrlForMarketing(href: string): string | undefined {
  try {
    const url = new URL(href);
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (SENSITIVE_QUERY_KEYS.has(lower) || lower.includes("token") || lower.includes("secret")) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    const out = url.toString();
    if (out.length > MAX_PAGE_URL_LENGTH) {
      return `${url.origin}${url.pathname}`.slice(0, MAX_PAGE_URL_LENGTH);
    }
    return out;
  } catch {
    return undefined;
  }
}
