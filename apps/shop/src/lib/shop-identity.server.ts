import { loadShopEnv } from "@/env";
import type { ShopIdentityMePayload } from "@auction/lax-ecosystem";

const DEFAULT_SHOP_IDENTITY_BASE_URL = "http://localhost:3010";

/** Server-side BFF calls must not block SSR longer than this. */
export const SHOP_IDENTITY_FETCH_TIMEOUT_MS = 3_000;

/** Must match apps/shop-identity session cookie names (BFF-only; not storefront host cookies). */
export const SHOP_IDENTITY_SESSION_COOKIE = "shop_identity_session";
export const SHOP_IDENTITY_ID_TOKEN_COOKIE = "shop_identity_id_token";

const SHOP_IDENTITY_COOKIE_NAMES = new Set([
  SHOP_IDENTITY_SESSION_COOKIE,
  SHOP_IDENTITY_ID_TOKEN_COOKIE,
]);

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Public shop host — browser links and redirects. */
export function shopIdentityBaseUrl(): string {
  const configured = loadShopEnv().SHOP_IDENTITY_BASE_URL;
  return (
    configured && configured.length > 0 ? configured : DEFAULT_SHOP_IDENTITY_BASE_URL
  ).replace(/\/+$/, "");
}

/** Private component URL when configured; otherwise public (local dev). */
export function shopIdentityServerBaseUrl(): string {
  const internal = loadShopEnv().SHOP_IDENTITY_INTERNAL_BASE_URL;
  if (internal && internal.length > 0) {
    return normalizeBaseUrl(internal);
  }
  return shopIdentityBaseUrl();
}

/** Absolute URL for browser navigation (login, logout, forms). */
export function shopIdentityUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${shopIdentityBaseUrl()}${normalized}`;
}

/** Absolute URL for server-side fetch to shop-identity BFF. */
export function shopIdentityServerUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${shopIdentityServerBaseUrl()}${normalized}`;
}

export function shopIdentityCookieHeader(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): string | undefined {
  const filtered = cookies.filter((cookie) => SHOP_IDENTITY_COOKIE_NAMES.has(cookie.name));
  if (filtered.length === 0) return undefined;
  return filtered.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function isShopIdentityMePayload(value: unknown): value is ShopIdentityMePayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.authenticated !== "boolean") return false;
  if ("reason" in record && typeof record.reason !== "string") return false;
  return true;
}

export type ShopIdentityMeReadResult = {
  /** True when the BFF returned a parseable session outcome (incl. guest/disabled). */
  sessionLookupOk: boolean;
  payload: ShopIdentityMePayload | null;
};

/** Interpret BFF `/me` HTTP semantics for ecosystem account chrome mapping. */
export function interpretShopIdentityMeResponse(
  status: number,
  body: unknown,
): ShopIdentityMeReadResult {
  if (status >= 500) {
    return { sessionLookupOk: false, payload: null };
  }
  if (status === 401 || status === 403 || status === 200) {
    if (!isShopIdentityMePayload(body)) {
      return { sessionLookupOk: false, payload: null };
    }
    return { sessionLookupOk: true, payload: body };
  }
  return { sessionLookupOk: false, payload: null };
}

export async function fetchShopIdentityMe(
  cookieHeader: string | undefined,
): Promise<ShopIdentityMeReadResult> {
  try {
    const response = await fetch(shopIdentityServerUrl("/me"), {
      cache: "no-store",
      signal: AbortSignal.timeout(SHOP_IDENTITY_FETCH_TIMEOUT_MS),
      headers: {
        accept: "application/json",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });
    const body = await response.json().catch(() => null);
    return interpretShopIdentityMeResponse(response.status, body);
  } catch {
    return { sessionLookupOk: false, payload: null };
  }
}
