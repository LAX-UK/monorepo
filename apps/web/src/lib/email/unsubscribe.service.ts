import { apiBaseUrl } from "@/lib/auth/api-base";
import type { ActionResult } from "@/lib/forms/form-result";

export type UnsubscribePreview = {
  scope: "global" | "type";
  notificationType: string | null;
  email: string;
};

export async function getUnsubscribePreview(token: string): Promise<UnsubscribePreview | null> {
  const res = await fetch(
    `${apiBaseUrl()}/email/unsubscribe/preview?t=${encodeURIComponent(token)}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: UnsubscribePreview };
  return body.data ?? null;
}

export async function confirmUnsubscribe(token: string): Promise<ActionResult<void>> {
  const res = await fetch(`${apiBaseUrl()}/email/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ t: token }),
  });
  if (!res.ok) return { ok: false, error: "We could not update your email preferences." };
  return { ok: true };
}
