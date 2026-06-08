import {
  CONSENT_COOKIE_NAME,
  type ConsentSnapshot,
  parseConsentCookie,
} from "@/lib/analytics/consent/cookie";

type CookieGet = { get(name: string): { value: string } | undefined };

/** Read parsed consent from Next.js `cookies()` or any compatible jar. */
export function readConsentFromCookies(cookieStore: CookieGet): ConsentSnapshot | null {
  return parseConsentCookie(cookieStore.get(CONSENT_COOKIE_NAME)?.value);
}
