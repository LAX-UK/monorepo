import "server-only";

import {
  CONSENT_COOKIE_NAME,
  type ConsentSnapshot,
  parseConsentCookie,
} from "@/lib/analytics/consent/cookie";
import { BID_API_AUDIENCE } from "@/lib/bff/config.server";
import { readBidSessionIdFromStore } from "@/lib/bff/session-cookie.server";
import { BidBffTokenService } from "@/lib/bff/token-service.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { deriveSsrOriginFromHeaders } from "@/lib/data/http/ssr-origin";
import { getActingLegalEntityHeader } from "@/lib/legal-entity/acting-context.server";
import { cookies, headers as nextHeaders } from "next/headers";

export type { HeaderBag } from "@/lib/data/http/ssr-origin";
export { deriveSsrOriginFromHeaders } from "@/lib/data/http/ssr-origin";

export type HeaderDecorator = (headers: Headers) => void | Promise<void>;

/** Builds outbound API request headers for SSR (DIP). */
export interface IServerRequestHeaders {
  build(init?: HeadersInit): Promise<Headers>;
}

export class ComposableServerRequestHeaders implements IServerRequestHeaders {
  constructor(private readonly decorators: HeaderDecorator[]) {}

  async build(init?: HeadersInit): Promise<Headers> {
    const headers = new Headers(init);
    for (const decorator of this.decorators) {
      await decorator(headers);
    }
    return headers;
  }
}

export async function deriveSsrOrigin(): Promise<string> {
  const h = await nextHeaders();
  return deriveSsrOriginFromHeaders({
    get: (name) => h.get(name),
  });
}

export function withBidApiBearer(): HeaderDecorator {
  return async (headers) => {
    const jar = await cookies();
    const sessionId = readBidSessionIdFromStore(jar);
    if (!sessionId) return;
    try {
      const resource = await new BidBffTokenService().resourceToken(
        sessionId,
        BID_API_AUDIENCE,
        "bid.read bid.write",
      );
      headers.set("Authorization", `Bearer ${resource.token}`);
    } catch {
      // Leave the request anonymous. The API remains the authorization boundary.
    }
  };
}

export function withOrigin(deriveOrigin: () => Promise<string> = deriveSsrOrigin): HeaderDecorator {
  return async (headers) => {
    if (!headers.has("Origin")) {
      headers.set("Origin", await deriveOrigin());
    }
  };
}

export function withActingLegalEntity(): HeaderDecorator {
  return async (headers) => {
    const user = await getServerSessionUser();
    const acting = await getActingLegalEntityHeader(user?.role ?? null, user?.staffRole ?? null);
    for (const [k, v] of Object.entries(acting)) {
      if (!headers.has(k)) headers.set(k, v);
    }
  };
}

export function withConsent(snapshot: ConsentSnapshot | null): HeaderDecorator {
  return (headers) => {
    if (!snapshot) return;
    headers.set("x-lax-consent-marketing", snapshot.marketing ? "1" : "0");
    headers.set("x-lax-consent-analytics", snapshot.analytics ? "1" : "0");
  };
}

export function withConsentFromCookie(): HeaderDecorator {
  return async (headers) => {
    const jar = await cookies();
    const raw = jar.get(CONSENT_COOKIE_NAME)?.value;
    const snapshot = raw ? parseConsentCookie(raw) : null;
    withConsent(snapshot)(headers);
  };
}

export type BuildAuthedSsrHeadersOptions = {
  skipActingLegalEntityHeader?: boolean;
  /** When set, skips reading consent from cookies. */
  consent?: ConsentSnapshot | null;
  init?: HeadersInit;
};

/** Resource Bearer + Origin (+ optional acting LE + consent) for authenticated SSR API calls. */
export async function buildAuthedSsrHeaders(
  options: BuildAuthedSsrHeadersOptions = {},
): Promise<Headers> {
  const decorators: HeaderDecorator[] = [withBidApiBearer(), withOrigin()];
  if (options.consent !== undefined) {
    decorators.push(withConsent(options.consent));
  } else {
    decorators.push(withConsentFromCookie());
  }
  if (!options.skipActingLegalEntityHeader) {
    decorators.push(withActingLegalEntity());
  }
  return new ComposableServerRequestHeaders(decorators).build(options.init);
}

/** Cookie + Origin only (no acting LE). */
export async function buildBaseSsrHeaders(init?: HeadersInit): Promise<Headers> {
  const opts: BuildAuthedSsrHeadersOptions = {
    skipActingLegalEntityHeader: true,
    consent: null,
  };
  if (init !== undefined) opts.init = init;
  return buildAuthedSsrHeaders(opts);
}
