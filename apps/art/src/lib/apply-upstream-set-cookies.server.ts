import { cookies } from "next/headers";

type ParsedSetCookie = {
  name: string;
  value: string;
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
};

function parseSetCookieHeader(header: string): ParsedSetCookie | null {
  const parts = header.split(";").map((part) => part.trim());
  const [nameValue, ...attrs] = parts;
  if (!nameValue) return null;
  const eq = nameValue.indexOf("=");
  if (eq <= 0) return null;
  const name = nameValue.slice(0, eq);
  const value = nameValue.slice(eq + 1);
  const parsed: ParsedSetCookie = { name, value };
  for (const attr of attrs) {
    const lower = attr.toLowerCase();
    if (lower === "httponly") parsed.httpOnly = true;
    else if (lower === "secure") parsed.secure = true;
    else if (lower.startsWith("path=")) parsed.path = attr.slice(5);
    else if (lower.startsWith("max-age=")) parsed.maxAge = Number.parseInt(attr.slice(8), 10);
    else if (lower.startsWith("samesite=")) {
      const site = attr.slice(9).toLowerCase();
      if (site === "lax" || site === "strict" || site === "none") parsed.sameSite = site;
    }
  }
  return parsed;
}

/** Apply Shop Identity Set-Cookie headers on the storefront origin (server actions and route handlers only). */
export async function applyUpstreamSetCookies(response: Response): Promise<void> {
  const legacySetCookie = response.headers.get("set-cookie");
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : legacySetCookie
        ? [legacySetCookie]
        : [];
  if (raw.length === 0) return;

  const store = await cookies();
  for (const header of raw) {
    const parsed = parseSetCookieHeader(header);
    if (!parsed) continue;
    store.set(parsed.name, parsed.value, {
      path: parsed.path ?? "/",
      ...(parsed.maxAge !== undefined ? { maxAge: parsed.maxAge } : {}),
      ...(parsed.httpOnly !== undefined ? { httpOnly: parsed.httpOnly } : {}),
      ...(parsed.secure !== undefined ? { secure: parsed.secure } : {}),
      ...(parsed.sameSite !== undefined ? { sameSite: parsed.sameSite } : {}),
    });
  }
}
