import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";

export type UnsubscribePreview = {
  scope: "global" | "type";
  notificationType: string | null;
  email: string;
};

export async function getUnsubscribePreview(token: string): Promise<UnsubscribePreview | null> {
  const res = await fetch(
    `${getServerApiBase()}/email/unsubscribe/preview?t=${encodeURIComponent(token)}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: UnsubscribePreview };
  return body.data ?? null;
}
