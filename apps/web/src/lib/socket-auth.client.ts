import { getAuthIssuerBaseUrl } from "@/lib/auth-client";
import { hasAuthSessionCookie } from "@/lib/auth/session-cookie";

type AuthTokenResponse = {
  token?: string;
};

export type SocketHandshakeAuth = Record<string, never> | { token: string };

/** Socket.IO auth payload: JWT when a session cookie exists, else anonymous. */
export async function resolveSocketHandshakeAuth(): Promise<SocketHandshakeAuth> {
  if (typeof window === "undefined") return {};
  if (!hasAuthSessionCookie(document.cookie)) return {};
  const token = await fetchAuthJwtForSocket();
  return token ? { token } : {};
}

/** Fetch a short-lived JWT for Socket.IO handshake (better-auth jwt plugin). */
export async function fetchAuthJwtForSocket(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const base = getAuthIssuerBaseUrl().replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/auth/token`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as AuthTokenResponse;
    return typeof json.token === "string" && json.token.length > 0 ? json.token : null;
  } catch {
    return null;
  }
}
