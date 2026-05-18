import { marketingConsentHeaderValues } from "@/lib/analytics/consent-headers";
import { sanitizePageUrlForMarketing } from "@/lib/analytics/sanitize-page-url";
import { type RpcApp, hcAsRpcApp } from "@/lib/data/http/rpc-app";

const MARKETING_PAGE_URL_HEADER = "x-lax-page-url";

const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

let browserClient: RpcApp | null = null;

/** Typed Hono RPC client with cookies sent on same-site API calls. */
export function getBrowserHc(): RpcApp {
  if (!browserClient) {
    browserClient = hcAsRpcApp(base, {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers as HeadersInit | undefined);
        for (const [k, v] of Object.entries(marketingConsentHeaderValues())) {
          headers.set(k, v);
        }
        if (typeof window !== "undefined" && window.location?.href) {
          const pageUrl = sanitizePageUrlForMarketing(window.location.href);
          if (pageUrl) headers.set(MARKETING_PAGE_URL_HEADER, pageUrl);
        }
        return fetch(input, {
          ...init,
          credentials: "include",
          headers,
        });
      },
    });
  }
  return browserClient;
}
