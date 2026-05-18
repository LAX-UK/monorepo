import type { MarketingClientContext, MarketingEvent, MarketingEventConsent } from "@auction/types";
import { marketingConsentFromHeaders } from "../infrastructure/header-marketing-consent.gate.js";
import { MARKETING_PAGE_URL_HEADER } from "../middleware/marketing-client-context.js";

export function buildMarketingEventConsent(
  marketing: boolean,
  analytics: boolean,
  basis: MarketingEventConsent["basis"] = "consent",
): MarketingEventConsent {
  return { marketing, analytics, basis };
}

export function nowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

type WebsiteEventContext = {
  get(key: "marketingConsentMarketing"): boolean | undefined;
  get(key: "marketingConsentAnalytics"): boolean | undefined;
  get(key: "marketingClientIp"): string | undefined;
  get(key: "marketingClientUserAgent"): string | undefined;
  req: { header: (name: string) => string | undefined };
};

const SENSITIVE_QUERY_KEYS = new Set([
  "token",
  "code",
  "session",
  "session_id",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "invite",
  "invite_token",
]);

function sanitizeEventSourceUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (SENSITIVE_QUERY_KEYS.has(lower) || lower.includes("token") || lower.includes("secret")) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    const out = `${url.origin}${url.pathname}${url.search}`;
    return out.length <= 2048 ? out : `${url.origin}${url.pathname}`.slice(0, 2048);
  } catch {
    return undefined;
  }
}

/** Resolve page URL for Meta event_source_url (SPA header, then Referer). */
export function eventSourceUrlFromContext(c: WebsiteEventContext): string | undefined {
  const pageUrl = c.req.header(MARKETING_PAGE_URL_HEADER)?.trim();
  if (pageUrl && /^https?:\/\//i.test(pageUrl)) return sanitizeEventSourceUrl(pageUrl);
  const referer = c.req.header("referer")?.trim();
  if (referer && /^https?:\/\//i.test(referer)) return sanitizeEventSourceUrl(referer);
  return undefined;
}

/** Client IP/UA for website events only. */
export function clientContextFromContext(
  c: WebsiteEventContext,
): MarketingClientContext | undefined {
  const ipAddress = c.get("marketingClientIp");
  const userAgent = c.get("marketingClientUserAgent");
  if (!ipAddress && !userAgent) return undefined;
  return {
    ...(ipAddress ? { ipAddress } : {}),
    ...(userAgent ? { userAgent } : {}),
  };
}

/** Website-only fields for Meta CAPI / sGTM (omit on system_generated events). */
export function websiteEventFieldsFromContext(c: WebsiteEventContext): {
  eventSourceUrl?: string;
  clientContext?: MarketingClientContext;
} {
  const eventSourceUrl = eventSourceUrlFromContext(c);
  const clientContext = clientContextFromContext(c);
  return {
    ...(eventSourceUrl ? { eventSourceUrl } : {}),
    ...(clientContext ? { clientContext } : {}),
  };
}

/** Missing consent headers default to denied (never grant-by-default). */
export function consentFromContextOrDeny(
  c: WebsiteEventContext,
  basis: MarketingEventConsent["basis"] = "consent",
): MarketingEventConsent {
  const marketingHeader = c.get("marketingConsentMarketing");
  const analyticsHeader = c.get("marketingConsentAnalytics");
  if (marketingHeader === undefined && analyticsHeader === undefined) {
    return buildMarketingEventConsent(false, false, basis);
  }
  return marketingConsentFromHeaders(marketingHeader ? "1" : "0", analyticsHeader ? "1" : "0");
}

/**
 * Build the common fields for a website-originated MarketingEvent.
 * Reduces the ~6-line boilerplate repeated across bid / payment / user routes.
 */
export function buildWebsiteUserEvent(
  c: WebsiteEventContext,
  input: {
    name: MarketingEvent["name"];
    eventId: string;
    userId: string;
    customData: MarketingEvent["customData"];
  },
): MarketingEvent {
  const websiteFields = websiteEventFieldsFromContext(c);
  return {
    name: input.name,
    eventId: input.eventId,
    eventTime: nowUnixSeconds(),
    actionSource: "website",
    userIdOrAnon: { kind: "user", userId: input.userId },
    consent: consentFromContextOrDeny(c),
    customData: input.customData,
    // exactOptionalPropertyTypes: only include when defined
    ...(websiteFields.eventSourceUrl ? { eventSourceUrl: websiteFields.eventSourceUrl } : {}),
    ...(websiteFields.clientContext ? { clientContext: websiteFields.clientContext } : {}),
  } as MarketingEvent;
}
