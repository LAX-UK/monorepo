import type { MarketingAttributionSnapshot } from "@auction/types";

async function requireOk(request: Promise<Response>): Promise<void> {
  const response = await request;
  if (!response.ok) throw new Error(`attribution_cookie_http_${response.status}`);
}

/** Server Set-Cookie avoids Safari's seven-day cap; document.cookie remains the fallback. */
export function persistAttributionCookieServer(
  snapshot: MarketingAttributionSnapshot,
): Promise<void> {
  return requireOk(
    fetch("/api/attribution", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    }),
  );
}

export function clearAttributionCookieServer(): Promise<void> {
  return requireOk(
    fetch("/api/attribution", {
      method: "DELETE",
      credentials: "same-origin",
    }),
  );
}
