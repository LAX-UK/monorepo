/** UK PECR: analytics cookies are set only after an explicit opt-in; the choice lasts 180 days. */
export const ART_CONSENT_COOKIE = "lax_art_consent";
export const ART_CONSENT_MAX_AGE_SEC = 60 * 60 * 24 * 180;
/** Footer link target that reopens the banner so consent can be withdrawn. */
export const ART_COOKIE_SETTINGS_HASH = "#cookie-settings";

export type ArtConsentChoice = "granted" | "denied";

export function parseArtConsent(raw: string | undefined): ArtConsentChoice | null {
  return raw === "granted" || raw === "denied" ? raw : null;
}

export function artConsentCookie(choice: ArtConsentChoice, secure: boolean): string {
  return [
    `${ART_CONSENT_COOKIE}=${choice}`,
    "Path=/",
    `Max-Age=${ART_CONSENT_MAX_AGE_SEC}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/** `measurementId` is validated as `G-[A-Z0-9]+` by the env schema before it reaches here. */
export function buildGtagInitSnippet(measurementId: string): string {
  return [
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js',new Date());",
    `gtag('config',${JSON.stringify(measurementId)});`,
  ].join("");
}
