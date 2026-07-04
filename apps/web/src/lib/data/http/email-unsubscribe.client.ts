import { apiBaseUrl } from "@/lib/auth/api-base";
import type { ActionResult } from "@/lib/forms/form-result";

export async function confirmUnsubscribe(token: string): Promise<ActionResult<void>> {
  const res = await fetch(`${apiBaseUrl()}/email/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token }),
  });
  if (!res.ok) return { ok: false, error: "We could not update your email preferences." };
  return { ok: true };
}
