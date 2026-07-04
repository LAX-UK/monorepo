import "server-only";

import { apiBaseUrl } from "@/lib/auth/api-base";

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
