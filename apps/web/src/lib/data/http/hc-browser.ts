import { marketingConsentHeaderValues } from "@/lib/analytics/consent-headers";
import { readConsentFromDocument } from "@/lib/analytics/consent-headers";
import {
  readGa4BrowserIdsFromDocument,
  serializeGa4BrowserIdsHeader,
} from "@/lib/analytics/ga4-browser-ids";
import { sanitizePageUrlForMarketing } from "@/lib/analytics/sanitize-page-url";
import { type RpcApp, hcAsRpcApp } from "@/lib/data/http/rpc-app";
import { getClientActingLegalEntityId } from "@/lib/legal-entity/client-acting-context";
import {
  MARKETING_GA4_IDS_HEADER,
  MARKETING_PAGE_URL_HEADER,
  X_LEGAL_ENTITY_ID_HEADER,
} from "@auction/http-headers";

const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";

function withBrowserApiHeaders(init?: RequestInit): RequestInit {
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  for (const [k, v] of Object.entries(marketingConsentHeaderValues())) {
    headers.set(k, v);
  }
  if (typeof window !== "undefined" && window.location?.href) {
    const pageUrl = sanitizePageUrlForMarketing(window.location.href);
    if (pageUrl) headers.set(MARKETING_PAGE_URL_HEADER, pageUrl);
  }
  if (readConsentFromDocument()?.analytics === true) {
    const ga4Header = serializeGa4BrowserIdsHeader(readGa4BrowserIdsFromDocument());
    if (ga4Header) headers.set(MARKETING_GA4_IDS_HEADER, ga4Header);
  }
  const actingEntityId = getClientActingLegalEntityId();
  if (actingEntityId && !headers.has(X_LEGAL_ENTITY_ID_HEADER)) {
    headers.set(X_LEGAL_ENTITY_ID_HEADER, actingEntityId);
  }
  return {
    ...init,
    credentials: "include",
    headers,
  };
}

/** Credentialed browser fetch with marketing + acting-entity headers (matches CORS allowlist). */
export function browserFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, withBrowserApiHeaders(init));
}

export function browserApiBase(): string {
  return base;
}

let browserClient: RpcApp | null = null;

/** Typed Hono RPC client with cookies sent on same-site API calls. */
export function getBrowserHc(): RpcApp {
  if (!browserClient) {
    browserClient = hcAsRpcApp(base, {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => browserFetch(input, init),
    });
  }
  return browserClient;
}
