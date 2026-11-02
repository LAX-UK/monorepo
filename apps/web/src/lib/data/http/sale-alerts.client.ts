import { apiBaseUrl } from "@/lib/auth/api-base";
import type { ActionResult } from "@/lib/forms/form-result";

const url = (path: string) => `${apiBaseUrl()}/sale-alerts${path}`;

/** Stops new-sale emails for the address an unsubscribe link belongs to. */
export async function unsubscribeVisitorAlerts(token: string): Promise<ActionResult<void>> {
  try {
    const res = await fetch(url(`/unsubscribe?t=${encodeURIComponent(token)}`), {
      method: "POST",
    });
    if (!res.ok) return { ok: false, error: "We couldn't unsubscribe you. Please try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "We couldn't reach LAX Bid. Check your connection and try again." };
  }
}

/** Ties the signed-in client's confirmed sale-alert sign-up to their account. */
export async function linkVisitorAlerts(): Promise<ActionResult<void>> {
  return mutate("/me/link", "POST", "We couldn't link these alerts. Try again.");
}

/** Turns off new-sale emails for the signed-in client's own address. */
export async function stopVisitorAlerts(): Promise<ActionResult<void>> {
  return mutate("/me", "DELETE", "We couldn't turn these alerts off. Try again.");
}

async function mutate(
  path: string,
  method: "POST" | "DELETE",
  failure: string,
): Promise<ActionResult<void>> {
  try {
    const res = await fetch(url(path), { method, credentials: "include" });
    return res.ok ? { ok: true } : { ok: false, error: failure };
  } catch {
    return { ok: false, error: "We couldn't reach LAX Bid. Check your connection and try again." };
  }
}
