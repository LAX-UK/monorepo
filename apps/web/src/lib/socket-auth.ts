import { getAuthIssuerBaseUrl } from "@/lib/auth-client";

type AuthTokenResponse = {
  token?: string;
};

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
