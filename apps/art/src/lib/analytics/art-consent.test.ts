import { describe, expect, it } from "vitest";
import { artConsentCookie, buildGtagInitSnippet, parseArtConsent } from "./art-consent";

describe("Art analytics consent", () => {
  it("treats anything but an explicit choice as undecided", () => {
    expect(parseArtConsent("granted")).toBe("granted");
    expect(parseArtConsent("denied")).toBe("denied");
    expect(parseArtConsent(undefined)).toBeNull();
    expect(parseArtConsent("yes")).toBeNull();
  });

  it("stores the choice for 180 days and marks it secure on https", () => {
    expect(artConsentCookie("granted", true)).toBe(
      "lax_art_consent=granted; Path=/; Max-Age=15552000; SameSite=Lax; Secure",
    );
    expect(artConsentCookie("denied", false)).not.toContain("Secure");
  });

  it("configures only the given GA4 stream", () => {
    expect(buildGtagInitSnippet("G-YGZCF5FD67")).toContain(`gtag('config',"G-YGZCF5FD67")`);
  });
});
