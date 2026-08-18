import "server-only";

import { getServerApiBase } from "@/lib/data/http/hc-server";
import { deriveSsrOrigin } from "@/lib/data/http/server-request-headers";

export async function forwardNewsletterSubscribe(body: Record<string, unknown>): Promise<Response> {
  return fetch(`${getServerApiBase()}/newsletter/subscribe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: await deriveSsrOrigin(),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}
