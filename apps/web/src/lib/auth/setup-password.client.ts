import { apiBaseUrl } from "@/lib/auth/api-base";
import { normalizeApiErrorMessage } from "@auction/validators";

export type SetupPasswordResult = { ok: true } | { ok: false; error: string };

/** POST /auth/setup-password */
export async function setupPasswordOnServer(password: string): Promise<SetupPasswordResult> {
  try {
    const res = await fetch(`${apiBaseUrl()}/auth/setup-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: unknown };
      return {
        ok: false,
        error: normalizeApiErrorMessage(body.error, `Could not set password (${res.status}).`),
      };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not set password." };
  }
}
