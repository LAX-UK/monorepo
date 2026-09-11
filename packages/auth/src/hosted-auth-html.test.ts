import { describe, expect, it } from "vitest";
import {
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorHtml,
  buildHostedVerifyEmailHtml,
  buildOidcConsentHtml,
} from "./index.js";
import { isSafeHostedReturnPath } from "./safe-return-url.js";

describe("issuer-hosted credential HTML", () => {
  it.each([
    ["login", buildHostedLoginHtml()],
    ["sign-up", buildHostedSignUpHtml()],
    ["forgot-password", buildHostedForgotPasswordHtml()],
    ["reset-password", buildHostedResetPasswordHtml()],
    ["verify-email", buildHostedVerifyEmailHtml()],
    ["resend-verification", buildHostedResendVerificationHtml()],
    [
      "two-factor",
      buildHostedTwoFactorHtml({ next: "/account", callbackURL: "/verify-email?email=a%40b.com" }),
    ],
  ])("renders shared hosted shell styling for %s", (_label, html) => {
    expect(html).toContain('class="brand"');
    expect(html).toContain('class="panel"');
    expect(html).toContain(":root {");
  });

  it("styles OIDC consent through the shared hosted shell", () => {
    const html = buildOidcConsentHtml({
      clientName: "LAX Shop Web",
      scopes: ["openid", "profile"],
      code: "opaque-consent-code",
    });
    expect(html).toContain('class="panel"');
    expect(html).toContain("Authorize LAX Shop Web");
    expect(html).toContain('value="opaque-consent-code"');
    expect(html).toContain('<script src="/oidc-consent.js" defer></script>');
  });
});

describe("isSafeHostedReturnPath", () => {
  it("accepts safe relative storefront paths and rejects auth loops", () => {
    expect(isSafeHostedReturnPath("/account")).toBe(true);
    expect(isSafeHostedReturnPath("/login")).toBe(false);
    expect(isSafeHostedReturnPath("//evil.example")).toBe(false);
    expect(isSafeHostedReturnPath("/api/auth/callback")).toBe(false);
  });
});
