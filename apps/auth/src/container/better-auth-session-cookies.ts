const BETTER_AUTH_SESSION_COOKIE = /^(?:__Secure-)?better-auth\.session_(?:token|data)(?:\.\d+)?$/;

export function stripBetterAuthSessionCookies(rawCookie: string | null | undefined): string {
  if (!rawCookie?.trim()) return "";
  return rawCookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => {
      const separator = part.indexOf("=");
      if (separator <= 0) return Boolean(part);
      const name = part.slice(0, separator);
      return !BETTER_AUTH_SESSION_COOKIE.test(name);
    })
    .join("; ");
}

export function readResponseSetCookies(response: Response): string[] {
  return typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie") ?? ""].filter(Boolean);
}

function sessionTokenClearCookie(setCookie: string): boolean {
  if (!/(?:__Secure-)?better-auth\.session_token=/.test(setCookie)) return false;
  if (/Max-Age=0/i.test(setCookie)) return true;
  return /(?:__Secure-)?better-auth\.session_token=;/i.test(setCookie);
}

function sessionDataClearCookieName(sessionTokenSetCookie: string): string | null {
  const match = sessionTokenSetCookie.match(/^((?:__Secure-)?better-auth)\.session_token=/);
  if (!match) return null;
  return `${match[1]}.session_data`;
}

export function buildSessionDataClearSetCookies(response: Response): string[] {
  const clears: string[] = [];
  for (const setCookie of readResponseSetCookies(response)) {
    if (!sessionTokenClearCookie(setCookie)) continue;
    const dataName = sessionDataClearCookieName(setCookie);
    if (!dataName) continue;
    const secure = dataName.startsWith("__Secure-");
    const suffix = secure ? "; Secure" : "";
    clears.push(
      `${dataName}=; Max-Age=0; Path=/${suffix}`,
      `${dataName}.0=; Max-Age=0; Path=/${suffix}`,
    );
  }
  return [...new Set(clears)];
}

export function withSessionDataClearedOnLogout(response: Response, path: string): Response {
  const logoutPath = path.endsWith("/sign-out") || path.endsWith("/oauth2/endsession");
  if (!logoutPath) return response;
  const extra = buildSessionDataClearSetCookies(response);
  if (extra.length === 0) return response;
  const headers = new Headers(response.headers);
  for (const cookie of extra) {
    headers.append("set-cookie", cookie);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
