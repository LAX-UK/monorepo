import {
  type CommerceCookieEntry,
  type CommerceCookiePort,
  SHOP_COMMERCE_CSRF_COOKIE,
  buildCommerceCookieHeader,
} from "./commerce-cookie-port.js";

const CLIENT_ADDRESS_HEADERS = ["x-forwarded-for", "x-real-ip"] as const;

export type CommerceBffRequestOptions = {
  /** When true, persist upstream Set-Cookie on the storefront (server actions only). */
  applyCookies?: boolean;
  csrfToken?: string;
};

export type CommerceBffClient = {
  request(path: string, init?: RequestInit, options?: CommerceBffRequestOptions): Promise<Response>;
};

export function createCommerceBffClient(config: {
  resolveUrl: (path: string) => string;
  cookiePort: CommerceCookiePort;
  commerceCookieNames: ReadonlySet<string>;
  timeoutMs: number;
  applyUpstreamSetCookies?: (response: Response) => Promise<void>;
  /**
   * Headers of the browser request being served. The proxy chain headers are forwarded so the
   * identity BFF can resolve the visitor's address for per-visitor rate limits; without them it
   * would only ever see this server.
   */
  requestHeaders?: () => Promise<{ get(name: string): string | null }>;
}): CommerceBffClient {
  const {
    resolveUrl,
    cookiePort,
    commerceCookieNames,
    timeoutMs,
    applyUpstreamSetCookies,
    requestHeaders,
  } = config;

  async function request(
    path: string,
    init?: RequestInit,
    options: CommerceBffRequestOptions = {},
  ): Promise<Response> {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const url = resolveUrl(normalized);

    const list = await cookiePort.readAll();
    let cookieHeader = buildCommerceCookieHeader(list, commerceCookieNames);

    const forwardHeaders = new Headers(init?.headers);
    if (options.csrfToken) {
      forwardHeaders.set("x-shop-csrf", options.csrfToken);
      const csrfFromStore = await cookiePort.read(SHOP_COMMERCE_CSRF_COOKIE);
      if (csrfFromStore) {
        const parts = cookieHeader ? cookieHeader.split("; ") : [];
        if (!parts.some((part) => part.startsWith(`${SHOP_COMMERCE_CSRF_COOKIE}=`))) {
          parts.push(`${SHOP_COMMERCE_CSRF_COOKIE}=${csrfFromStore}`);
        }
        cookieHeader = parts.join("; ");
      }
    }
    if (requestHeaders) {
      const incoming = await requestHeaders();
      for (const name of CLIENT_ADDRESS_HEADERS) {
        const value = incoming.get(name);
        if (value && !forwardHeaders.has(name)) forwardHeaders.set(name, value);
      }
    }
    if (cookieHeader && !forwardHeaders.has("cookie")) {
      forwardHeaders.set("cookie", cookieHeader);
    }

    const response = await fetch(url, {
      ...init,
      headers: forwardHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (options.applyCookies && applyUpstreamSetCookies) {
      await applyUpstreamSetCookies(response);
    }

    return response;
  }

  return { request };
}

export type { CommerceCookieEntry, CommerceCookiePort };
