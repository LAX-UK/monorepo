import { marketingConsentHeaderValues } from "@/lib/analytics/consent-headers";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { MarketingAttributionSnapshot } from "@auction/types";

async function requireSuccessfulResponse(request: Promise<Response>): Promise<void> {
  const response = await request;
  if (!response.ok) {
    throw new Error(`marketing_attribution_http_${response.status}`);
  }
}

/** PUT /marketing/attribution. */
export function syncMarketingAttribution(snapshot: MarketingAttributionSnapshot): Promise<void> {
  return requireSuccessfulResponse(
    browserFetch(`${browserApiBase()}/marketing/attribution`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...marketingConsentHeaderValues(),
      },
      body: JSON.stringify({ snapshot }),
    }),
  );
}

/** DELETE /marketing/attribution on consent withdrawal. */
export function deleteMarketingAttribution(): Promise<void> {
  return requireSuccessfulResponse(
    browserFetch(`${browserApiBase()}/marketing/attribution`, {
      method: "DELETE",
      headers: marketingConsentHeaderValues(),
    }),
  );
}
