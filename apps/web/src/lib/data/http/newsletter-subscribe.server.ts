import "server-only";

import { apiBaseUrl } from "@/lib/auth/api-base";

export async function forwardNewsletterSubscribe(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${apiBaseUrl()}/newsletter/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}
