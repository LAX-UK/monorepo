import { createMiddleware } from "hono/factory";

export type MarketingConsentVars = {
  marketingConsentMarketing?: boolean;
  marketingConsentAnalytics?: boolean;
};

export const MARKETING_CONSENT_HEADERS = {
  marketing: "x-lax-consent-marketing",
  analytics: "x-lax-consent-analytics",
} as const;

export function createMarketingConsentMiddleware() {
  return createMiddleware<{ Variables: MarketingConsentVars }>(async (c, next) => {
    const m = c.req.header(MARKETING_CONSENT_HEADERS.marketing);
    const a = c.req.header(MARKETING_CONSENT_HEADERS.analytics);
    if (m === "1" || m === "0") {
      c.set("marketingConsentMarketing", m === "1");
    }
    if (a === "1" || a === "0") {
      c.set("marketingConsentAnalytics", a === "1");
    }
    await next();
  });
}
