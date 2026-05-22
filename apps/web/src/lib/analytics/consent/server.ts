import {
  CONSENT_COOKIE_NAME,
  type ConsentSnapshot,
  parseConsentCookie,
} from "@/lib/analytics/consent/cookie";
import { isConsentBannerDisabled } from "@/lib/analytics/consent/disable-banner";

type CookieGet = { get(name: string): { value: string } | undefined };

/** Read parsed consent from Next.js `cookies()` or any compatible jar. */
export function readConsentFromCookies(cookieStore: CookieGet): ConsentSnapshot | null {
  return parseConsentCookie(cookieStore.get(CONSENT_COOKIE_NAME)?.value);
}

/**
 * Consent snapshot for SSR, honouring the pre-launch disable-banner toggle.
 *
 * TEMPORARY (marketing pre-launch test): when `NEXT_PUBLIC_DISABLE_CONSENT_BANNER=true`,
 * returns a synthesised "all granted" snapshot so the banner never renders and GA4/GTM
 * loads on the first page view. REMOVE this branch (and the helper module) before go-live.
 */
export function readEffectiveConsentFromCookies(cookieStore: CookieGet): ConsentSnapshot | null {
  if (isConsentBannerDisabled()) {
    return {
      v: 1,
      ts: new Date().toISOString(),
      necessary: true,
      analytics: true,
      marketing: true,
    };
  }
  return readConsentFromCookies(cookieStore);
}
