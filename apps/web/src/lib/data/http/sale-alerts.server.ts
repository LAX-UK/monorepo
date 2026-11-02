import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { getServerApiBase } from "@/lib/data/http/hc-server";
import { deriveSsrOrigin } from "@/lib/data/http/server-request-headers";

/** Where the visitor sale-alerts API lives. */
const base = () => `${getServerApiBase()}/sale-alerts`;

/** What following a confirmation link did. `failed` means the check itself could not be made. */
export type VisitorAlertConfirmResult = "confirmed" | "expired" | "invalid" | "failed";

export type VisitorAlertSettingsState = "none" | "pending" | "on" | "linked";

export async function forwardVisitorAlertSignup(input: {
  email: string;
  source: string;
}): Promise<Response> {
  return fetch(`${base()}/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: await deriveSsrOrigin() },
    body: JSON.stringify(input),
    cache: "no-store",
  });
}

export async function confirmVisitorAlert(token: string): Promise<VisitorAlertConfirmResult> {
  try {
    const res = await fetch(`${base()}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: await deriveSsrOrigin() },
      body: JSON.stringify({ token }),
      cache: "no-store",
    });
    if (res.status === 400) return "invalid";
    if (!res.ok) return "failed";
    const body = (await res.json().catch(() => null)) as { outcome?: string } | null;
    return body?.outcome === "confirmed" || body?.outcome === "expired" ? body.outcome : "invalid";
  } catch {
    return "failed";
  }
}

/** The address an unsubscribe link belongs to; null when the link is not genuine. */
export async function getVisitorAlertUnsubscribePreview(
  token: string,
): Promise<{ email: string } | null> {
  try {
    const res = await fetch(`${base()}/unsubscribe/preview?t=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { email?: string } };
    return body.data?.email ? { email: body.data.email } : null;
  } catch {
    return null;
  }
}

/** The signed-in client's view of the visitor list for their own address; null if unreadable. */
export async function getServerVisitorAlertState(): Promise<VisitorAlertSettingsState | null> {
  try {
    const res = await authedServerFetch("/sale-alerts/me", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { state?: VisitorAlertSettingsState } };
    return body.data?.state ?? null;
  } catch {
    return null;
  }
}
