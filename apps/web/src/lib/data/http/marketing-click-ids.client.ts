import { marketingConsentHeaderValues } from "@/lib/analytics/consent-headers";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

/** POST /marketing/click-ids (fire-and-forget attribution sync). */
export function syncMarketingClickIds(payload: Record<string, string | undefined>): void {
  void browserFetch(`${browserApiBase()}/marketing/click-ids`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...marketingConsentHeaderValues(),
    },
    body: JSON.stringify(payload),
  });
}
