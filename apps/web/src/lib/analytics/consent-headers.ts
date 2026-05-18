import { CONSENT_COOKIE_NAME, parseConsentCookie } from "./consent/cookie";

/** Read lax_consent from document.cookie (browser only). */
export function readConsentFromDocument(): {
  marketing: boolean;
  analytics: boolean;
} | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");
  if (!raw) return null;
  const snapshot = parseConsentCookie(decodeURIComponent(raw));
  if (!snapshot) return null;
  return { marketing: snapshot.marketing, analytics: snapshot.analytics };
}

export function marketingConsentHeaderValues(): Record<string, string> {
  const c = readConsentFromDocument();
  if (!c) return {};
  return {
    "x-lax-consent-marketing": c.marketing ? "1" : "0",
    "x-lax-consent-analytics": c.analytics ? "1" : "0",
  };
}
