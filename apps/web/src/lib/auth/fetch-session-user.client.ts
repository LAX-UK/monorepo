import { apiBaseUrl } from "@/lib/auth/api-base";
import type { SessionUser } from "@/lib/data/contracts";

/** After Better Auth sign-in, resolve the session user for client-side redirects. */
export async function fetchSessionUserAfterAuth(): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${apiBaseUrl()}/users/me`, { credentials: "include" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: SessionUser };
    return body.data ?? null;
  } catch {
    return null;
  }
}
