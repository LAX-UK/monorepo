import type { WorkerEnv } from "../../env.js";
import { ZohoCrmAuthError } from "./types.js";

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let cached: TokenCache | null = null;

/** Told how each refresh went, so the connection's health can be kept. It must never throw. */
export type ZohoTokenRefreshObserver = {
  refreshed(expiresAt: Date): void;
  /** `code` is a short code, never Zoho's response text. */
  failed(code: string): void;
};

let observer: ZohoTokenRefreshObserver | null = null;

export function setZohoTokenRefreshObserver(next: ZohoTokenRefreshObserver | null): void {
  observer = next;
}

/** `zoho_token_refresh_failed_400:{"error":...}` is reported as `zoho_token_refresh_failed_400`. */
function failureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const code = message.split(":")[0] ?? "";
  return code.startsWith("zoho_token_refresh_") ? code : "zoho_token_refresh_unreachable";
}

export async function getZohoCrmAccessToken(env: WorkerEnv): Promise<string | null> {
  if (!env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET || !env.ZOHO_REFRESH_TOKEN) {
    return null;
  }

  const now = Date.now();
  if (cached && cached.expiresAtMs > now + 60_000) {
    return cached.accessToken;
  }

  const url = new URL("/oauth/v2/token", env.ZOHO_ACCOUNTS_HOST);
  url.searchParams.set("refresh_token", env.ZOHO_REFRESH_TOKEN);
  url.searchParams.set("client_id", env.ZOHO_CLIENT_ID);
  url.searchParams.set("client_secret", env.ZOHO_CLIENT_SECRET);
  url.searchParams.set("grant_type", "refresh_token");

  try {
    return await refreshAccessToken(url, now);
  } catch (error) {
    observer?.failed(failureCode(error));
    throw error;
  }
}

async function refreshAccessToken(url: URL, now: number): Promise<string> {
  const res = await fetch(url, { method: "POST" });
  const text = await res.text();
  if (!res.ok) {
    throw new ZohoCrmAuthError(
      `zoho_token_refresh_failed_${res.status}:${text.slice(0, 200)}`,
      res.status,
    );
  }

  let json: { access_token?: string; expires_in?: number };
  try {
    json = JSON.parse(text) as { access_token?: string; expires_in?: number };
  } catch {
    throw new ZohoCrmAuthError("zoho_token_refresh_invalid_json");
  }

  if (!json.access_token) {
    throw new ZohoCrmAuthError("zoho_token_refresh_missing_access_token");
  }

  const ttlSec = typeof json.expires_in === "number" ? json.expires_in : 3600;
  cached = {
    accessToken: json.access_token,
    expiresAtMs: now + ttlSec * 1000,
  };
  observer?.refreshed(new Date(cached.expiresAtMs));
  return cached.accessToken;
}

export function invalidateZohoCrmAccessToken(): void {
  cached = null;
}

/** Test hook */
export function resetZohoTokenCacheForTests(): void {
  invalidateZohoCrmAccessToken();
}
