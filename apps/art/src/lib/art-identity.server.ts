import { loadArtEnv } from "@/env.server";
import type { ShopIdentityMePayload } from "@auction/lax-ecosystem";

/** Second local shop-identity instance (lax-art-web) per D37. */
const DEFAULT_ART_IDENTITY_BASE_URL = "http://localhost:3051";

export const ART_IDENTITY_FETCH_TIMEOUT_MS = 3_000;

export const ART_IDENTITY_SESSION_COOKIE = "shop_identity_session";
export const ART_IDENTITY_ID_TOKEN_COOKIE = "shop_identity_id_token";

const ART_IDENTITY_COOKIE_NAMES = new Set([
  ART_IDENTITY_SESSION_COOKIE,
  ART_IDENTITY_ID_TOKEN_COOKIE,
]);

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function artIdentityBaseUrl(): string {
  const configured = loadArtEnv().ART_IDENTITY_BASE_URL;
  return (configured && configured.length > 0 ? configured : DEFAULT_ART_IDENTITY_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

export function artIdentityServerBaseUrl(): string {
  const internal = loadArtEnv().ART_IDENTITY_INTERNAL_BASE_URL;
  if (internal && internal.length > 0) {
    return normalizeBaseUrl(internal);
  }
  return artIdentityBaseUrl();
}

export function artIdentityUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${artIdentityBaseUrl()}${normalized}`;
}

export function artIdentityServerUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${artIdentityServerBaseUrl()}${normalized}`;
}

export function artIdentityCookieHeader(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): string | undefined {
  const filtered = cookies.filter((cookie) => ART_IDENTITY_COOKIE_NAMES.has(cookie.name));
  if (filtered.length === 0) return undefined;
  return filtered.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function isArtIdentityMePayload(value: unknown): value is ShopIdentityMePayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.authenticated !== "boolean") return false;
  if ("reason" in record && typeof record.reason !== "string") return false;
  return true;
}

export type ArtIdentityMeReadResult = {
  sessionLookupOk: boolean;
  payload: ShopIdentityMePayload | null;
};

export function interpretArtIdentityMeResponse(
  status: number,
  body: unknown,
): ArtIdentityMeReadResult {
  if (status >= 500) {
    return { sessionLookupOk: false, payload: null };
  }
  if (status === 401 || status === 403 || status === 200) {
    if (!isArtIdentityMePayload(body)) {
      return { sessionLookupOk: false, payload: null };
    }
    return { sessionLookupOk: true, payload: body };
  }
  return { sessionLookupOk: false, payload: null };
}

export async function fetchArtIdentityMe(
  cookieHeader: string | undefined,
): Promise<ArtIdentityMeReadResult> {
  try {
    const response = await fetch(artIdentityServerUrl("/me"), {
      cache: "no-store",
      signal: AbortSignal.timeout(ART_IDENTITY_FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });
    const body = await response.json().catch(() => null);
    return interpretArtIdentityMeResponse(response.status, body);
  } catch {
    return { sessionLookupOk: false, payload: null };
  }
}
