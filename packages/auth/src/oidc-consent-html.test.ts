import { describe, expect, it } from "vitest";
import { OIDC_CONSENT_SCRIPT, buildOidcConsentHtml } from "./oidc-consent-html.js";

describe("OIDC consent HTML", () => {
  it("escapes client-controlled metadata and posts the opaque consent code", () => {
    const html = buildOidcConsentHtml({
      clientName: '<script>alert("x")</script>',
      scopes: ["openid", "<img onerror=alert(1)>"],
      code: "</script><script>alert(2)</script>",
    });
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(html).toContain("&lt;/script&gt;&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).toContain('<script src="/oidc-consent.js" defer></script>');
    expect(OIDC_CONSENT_SCRIPT).toContain('fetch("/api/auth/oauth2/consent"');
  });
});
