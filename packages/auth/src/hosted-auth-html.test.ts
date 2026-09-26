import { describe, expect, it } from "vitest";
import {
  HOSTED_BID_LOGO_PATH,
  HOSTED_SHOP_LOGO_PATH,
  selectHostedBrand,
} from "./hosted-auth/brand.js";
import { HOSTED_AUTH_RUNTIME_SCRIPT } from "./hosted-auth/runtime.js";
import { HOSTED_AUTH_STYLES } from "./hosted-auth/styles.js";
import { hostedAuthViewFromSearch } from "./hosted-auth/view.js";
import {
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedMagicLinkHtml,
  buildHostedPhoneHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorHtml,
  buildHostedVerifyEmailHtml,
  buildOidcConsentHtml,
} from "./index.js";
import { isSafeHostedReturnPath } from "./safe-return-url.js";

const shopSearch =
  "response_type=code&client_id=lax-shop-web&redirect_uri=http://localhost:3010/auth/callback&scope=openid&state=abc&nonce=def&code_challenge=challenge&code_challenge_method=S256";

const shopCapabilities = {
  googleEnabled: true,
  appleEnabled: false,
  phoneEnabled: true,
  turnstileSiteKey: "site-key",
  shopOrigin: "http://localhost:3020",
  bidOrigin: "http://localhost:3000",
  emailFirst: true,
  requireEmailVerification: true,
};

describe("issuer-hosted credential HTML", () => {
  it.each([
    ["login", buildHostedLoginHtml()],
    ["sign-up", buildHostedSignUpHtml()],
    ["forgot-password", buildHostedForgotPasswordHtml()],
    ["reset-password", buildHostedResetPasswordHtml()],
    ["verify-email", buildHostedVerifyEmailHtml()],
    ["resend-verification", buildHostedResendVerificationHtml()],
    ["two-factor", buildHostedTwoFactorHtml()],
    ["magic-link", buildHostedMagicLinkHtml()],
    ["phone", buildHostedPhoneHtml()],
  ])("renders shared hosted shell styling for %s", (_label, html) => {
    expect(html).toContain('class="brand"');
    expect(html).toContain('class="panel"');
    expect(html).toContain('href="/hosted-auth.css');
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("London Art Exchange");
    expect(html).toContain('class="skip-link"');
    expect(html).toContain("/hosted-auth-runtime.js");
    expect(html).toContain("Enable JavaScript to continue signing in.");
    expect(html).not.toContain("callbackURL");
    expect(html).not.toContain("challenges.cloudflare.com");
  });

  it.each([
    ["login", buildHostedLoginHtml()],
    ["sign-up", buildHostedSignUpHtml()],
    ["forgot-password", buildHostedForgotPasswordHtml()],
    ["reset-password", buildHostedResetPasswordHtml()],
    ["resend-verification", buildHostedResendVerificationHtml()],
    ["two-factor", buildHostedTwoFactorHtml()],
    ["magic-link", buildHostedMagicLinkHtml()],
    ["phone", buildHostedPhoneHtml()],
  ])("uses floating-label primitives and scoped buttons on %s", (_label, html) => {
    expect(html).toContain("field-control");
    expect(html).toContain("btn btn-primary");
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
    expect(html).toContain('class="actions"');
    expect(html).toContain("btn btn-primary");
    expect(html).toContain("btn btn-secondary");
    expect(html).toContain('<script src="/oidc-consent.js');
    expect(html).toContain('class="theme-shop"');
    expect(html).toContain(HOSTED_SHOP_LOGO_PATH);
  });

  it("uses Bid auth tokens for CTA and page shell", () => {
    expect(HOSTED_AUTH_STYLES).toContain("--color-cta-bg: #000000");
    expect(HOSTED_AUTH_STYLES).toContain("--color-page-bg: #ffffff");
    expect(HOSTED_AUTH_STYLES).toContain("--auth-column: 528px");
    expect(HOSTED_AUTH_STYLES).toContain("Montserrat");
    expect(HOSTED_AUTH_STYLES).toContain("--control-min: 2.75rem");
  });

  it("applies the Shop mark and email-first sign-in for lax-shop-web", () => {
    const view = hostedAuthViewFromSearch(shopSearch, shopCapabilities);
    const html = buildHostedLoginHtml(view);
    expect(html).toContain('class="theme-shop"');
    expect(html).toContain(HOSTED_SHOP_LOGO_PATH);
    expect(html).toContain("Sign in to your LAX Shop account to continue.");
    expect(html).toContain("Continue with Google");
    expect(html).not.toContain("Continue with Apple");
    expect(html).toContain('data-email-first="true"');
    expect(html).toContain('data-login-step="email"');
    expect(html).toContain('data-login-step="credentials"');
    expect(html).toContain('data-login-step="magic-link-sent"');
    expect(html).toContain("Forgot password?");
    expect(html).toContain("Email me a sign-in link instead");
    expect(html).toContain("Sign in with phone number");
    expect(html).toContain('href="/phone?client_id=lax-shop-web"');
    expect(html).toContain('href="/forgot-password?client_id=lax-shop-web"');
    expect(html).not.toMatch(/href="\/[^"]*code_challenge/);
    expect(html).not.toMatch(/href="\/[^"]*state=/);
    expect(html).toContain("data-password-toggle");
    expect(html).toContain("btn-reveal");
    expect(html).toContain("Email Address");
    expect(html).not.toContain("bid-logo");
    expect(html).not.toContain("/shop/lax-shop-logo.svg");
    expect(html).toContain("turnstile-host");
    expect(html).not.toContain("challenges.cloudflare.com");
    expect(view.config.authorizeResumePath).toContain("code_challenge=");
    expect(view.config.loginPath).toBe("/login?client_id=lax-shop-web");
  });

  it("keeps the combined email/password mode behind issuer configuration", () => {
    const view = hostedAuthViewFromSearch(shopSearch, { ...shopCapabilities, emailFirst: false });
    const html = buildHostedLoginHtml(view);
    expect(html).toContain('data-email-first="false"');
    expect(html).not.toContain('data-login-step="email"');
    expect(html).toContain("Email Address");
    expect(html).toContain("Password");
  });

  it("keeps generic errors and validated continuation in the shared runtime", () => {
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("Invalid email or password.");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("Unable to create your account. Try again later.");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("allowedRedirectOrigins");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("authorizeResumePath");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("restartUrl");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).not.toContain('params.get("callbackURL")');
  });

  it("does not echo issuer error messages from password sign-in", async () => {
    const { HOSTED_LOGIN_SCRIPT } = await import("./hosted-auth/pages/login.js");
    expect(HOSTED_LOGIN_SCRIPT).toContain("GENERIC_SIGN_IN");
    expect(HOSTED_LOGIN_SCRIPT).toContain("productHintLoginUrl");
    expect(HOSTED_LOGIN_SCRIPT).not.toContain("payload?.message");
    expect(HOSTED_LOGIN_SCRIPT).not.toContain("data?.message");
    expect(HOSTED_LOGIN_SCRIPT).not.toContain("authorizeResumePath");
  });

  it("uses the same check-email copy for successful and existing-account sign-up", async () => {
    const { HOSTED_SIGN_UP_SCRIPT } = await import("./hosted-auth/pages/sign-up.js");
    expect(HOSTED_SIGN_UP_SCRIPT).toContain("REGISTER_CHECK_EMAIL");
    expect(HOSTED_SIGN_UP_SCRIPT).toContain("requireEmailVerification");
    expect(HOSTED_SIGN_UP_SCRIPT).not.toContain("USER_ALREADY_EXISTS");
    expect(HOSTED_SIGN_UP_SCRIPT).not.toContain("data?.message");
    expect(HOSTED_AUTH_RUNTIME_SCRIPT).toContain("Check your email to continue.");
  });

  it("escapes untrusted values at the primitive boundary", () => {
    const html = buildOidcConsentHtml({
      clientName: "<img src=x onerror=alert(1)>",
      scopes: ["<script>"],
      code: '"><img src=x>',
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("selectHostedBrand", () => {
  it("selects Shop branding only for the registered Shop client", () => {
    expect(selectHostedBrand("lax-shop-web").theme).toBe("shop");
    expect(selectHostedBrand("lax-shop-web").logoSrc).toBe(HOSTED_SHOP_LOGO_PATH);
    expect(selectHostedBrand("lax-bid-web").theme).toBe("bid");
    expect(selectHostedBrand("lax-bid-web").logoSrc).toBe(HOSTED_BID_LOGO_PATH);
    expect(selectHostedBrand("unknown").theme).toBe("default");
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
