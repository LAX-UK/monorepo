import { describe, expect, it } from "vitest";
import { HOSTED_AUTH_RUNTIME_SCRIPT } from "./hosted-auth/runtime.js";
import { HOSTED_AUTH_STYLES } from "./hosted-auth/styles.js";
import { hostedAuthViewFromSearch } from "./hosted-auth/view.js";
import {
  buildHostedAccountChooserHtml,
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedMagicLinkHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorHelpHtml,
  buildHostedTwoFactorHtml,
  buildHostedTwoFactorSetupHtml,
  buildHostedVerifyEmailHtml,
  buildOidcConsentHtml,
  parseTwoFactorSetupRequiredBy,
} from "./index.js";
import { isSafeHostedReturnPath } from "./safe-return-url.js";

/** The visible text of rendered markup, for copy split across elements. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, "");

const shopSearch =
  "response_type=code&client_id=lax-shop-web&redirect_uri=http://localhost:3010/auth/callback&scope=openid&state=abc&nonce=def&code_challenge=challenge&code_challenge_method=S256";

const shopCapabilities = {
  googleEnabled: true,
  appleEnabled: false,
  phoneEnabled: true,
  turnstileSiteKey: "site-key",
  shopOrigin: "http://localhost:3020",
  artOrigin: "http://localhost:3050",
  shopAdminOrigin: "http://localhost:3030",
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
    ["two-factor-setup", buildHostedTwoFactorSetupHtml()],
    ["magic-link", buildHostedMagicLinkHtml()],
  ])("renders shared hosted shell styling for %s", (_label, html) => {
    expect(html).toContain('class="brand"');
    expect(html).toContain('class="panel"');
    expect(html).toContain('href="/hosted-auth.css');
    expect(html).toContain('<html lang="en-GB">');
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).toContain("/hosted-auth/lockups/lax-account.svg");
    expect(html).toContain("/hosted-auth/lockups/lax-account-dark.svg");
    expect(html).toContain('alt="LAX Account"');
    expect(html).toContain("/hosted-auth/fonts/montserrat-latin-wght-normal.woff2");
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
    ["two-factor-setup", buildHostedTwoFactorSetupHtml()],
    ["magic-link", buildHostedMagicLinkHtml()],
  ])("uses floating-label primitives and scoped buttons on %s", (_label, html) => {
    expect(html).toContain("field-control");
    expect(html).toContain("btn btn-primary");
  });

  describe("reset-password page", () => {
    it("keeps the status region and the new-link route outside the form so a dead link still shows them", () => {
      const html = buildHostedResetPasswordHtml(hostedAuthViewFromSearch(shopSearch));
      const form = /<form id="reset-form"[\s\S]*?<\/form>/.exec(html)?.[0] ?? "";
      expect(form).not.toContain('id="error"');
      expect(html.indexOf('id="error"')).toBeGreaterThan(html.indexOf("</form>"));
      expect(html).toMatch(/id="reset-new-link"[^>]*hidden/);
      expect(html).toContain("Request a new link");
    });

    it("sends the new-link route to forgot-password with the client and return parameters", () => {
      const html = buildHostedResetPasswordHtml(hostedAuthViewFromSearch(shopSearch));
      const href = /id="reset-new-link"[\s\S]*?href="([^"]+)"/.exec(html)?.[1] ?? "";
      const url = new URL(href.replaceAll("&amp;", "&"), "https://auth.test");
      expect(url.pathname).toBe("/forgot-password");
      expect(url.searchParams.get("client_id")).toBe("lax-shop-web");
      expect(url.searchParams.get("state")).toBe("abc");
    });

    it("falls back to the bare forgot-password page without a client", () => {
      expect(buildHostedResetPasswordHtml()).toContain('href="/forgot-password"');
    });
  });

  describe("two-step lost-access route", () => {
    it("links the challenge page to the help page, keeping the sign-in parameters", () => {
      const html = buildHostedTwoFactorHtml(hostedAuthViewFromSearch(shopSearch));
      const href = /href="([^"]+)">Can't use your authenticator app\?/.exec(html)?.[1] ?? "";
      const url = new URL(href.replaceAll("&amp;", "&"), "https://auth.test");
      expect(url.pathname).toBe("/two-factor/help");
      expect(url.searchParams.get("client_id")).toBe("lax-shop-web");
      expect(url.searchParams.get("state")).toBe("abc");
    });

    it("explains that support resets two-step after checking identity, with Bid's contact route", () => {
      const html = buildHostedTwoFactorHelpHtml(hostedAuthViewFromSearch(shopSearch));
      expect(html).toContain("LAX support can reset two-step verification for you");
      expect(html).toContain("check it's really you");
      expect(html).toContain('href="http://localhost:3000/contact"');
      expect(html).toContain('alt="LAX Account"');
      expect(html).toContain("/two-factor?client_id=lax-shop-web");
    });
  });

  describe("account chooser page", () => {
    const input = {
      intent: "sign-in" as const,
      name: "Jane Doe",
      email: "jane.doe@example.test",
      continueUrl: "https://shop.example.test/login",
      switchUrl: "/login?client_id=lax-shop-web",
    };

    it("names the signed-in account with a masked address and offers both choices", () => {
      const html = buildHostedAccountChooserHtml(input);
      expect(html).toContain("Continue as Jane Doe?");
      expect(html).toContain("This device is signed in to j***@example.test.");
      expect(html).not.toContain("jane.doe@example.test");
      expect(html).toMatch(
        /<a class="btn btn-primary" id="chooser-continue" href="https:\/\/shop.example.test\/login">Continue<\/a>/,
      );
      expect(html).toContain("Use a different account");
      expect(html).toContain('src="/hosted-account-chooser.js');
    });

    it("keeps the shared hosted shell: LAX Account lockup and status region", () => {
      const html = buildHostedAccountChooserHtml(input);
      expect(html).toContain('alt="LAX Account"');
      expect(html).toContain('id="error"');
    });

    it("escapes a name that carries markup", () => {
      const html = buildHostedAccountChooserHtml({ ...input, name: '<img src=x onerror="a">' });
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img src=x");
    });

    it("falls back to the product name when the account has no name", () => {
      expect(buildHostedAccountChooserHtml({ ...input, name: "  " })).toContain(
        "Continue as LAX Account?",
      );
    });
  });

  it("explains who requires two-step verification on forced setup", () => {
    const view = hostedAuthViewFromSearch(shopSearch);
    expect(buildHostedTwoFactorSetupHtml(view, "staff")).toContain(
      "LAX requires two-step verification for staff accounts.",
    );
    expect(buildHostedTwoFactorSetupHtml(view, "org")).toContain(
      "Your organisation requires two-step verification.",
    );
    expect(parseTwoFactorSetupRequiredBy("admin")).toBeNull();
  });

  it("accepts a pasted code with a space and keeps the setup password optional", () => {
    const challenge = buildHostedTwoFactorHtml();
    const setup = buildHostedTwoFactorSetupHtml();
    for (const html of [challenge, setup]) {
      expect(html).toMatch(/maxlength="12"/);
      expect(html).toContain('pattern="[0-9]{6}"');
    }
    const password = /<input[^>]*id="setup-password"[^>]*>/.exec(setup)?.[0] ?? "";
    expect(password).not.toContain("required");
  });

  it("stops phones capitalising or correcting a backup code", () => {
    const backup = /<input[^>]*id="backup-code"[^>]*>/.exec(buildHostedTwoFactorHtml())?.[0] ?? "";
    expect(backup).toContain('autocapitalize="off"');
    expect(backup).toContain('autocorrect="off"');
    expect(backup).toContain('spellcheck="false"');
  });

  it("lets script move focus to the page-level error", () => {
    expect(buildHostedTwoFactorHtml()).toMatch(/<p id="error"[^>]*tabindex="-1"/);
  });

  it("only tells accounts without a password to leave it blank when no policy requires 2FA", () => {
    const view = hostedAuthViewFromSearch(shopSearch);
    expect(buildHostedTwoFactorSetupHtml(view, null)).toContain("leave it blank");
    const required = buildHostedTwoFactorSetupHtml(view, "staff");
    expect(required).not.toContain("leave it blank");
    expect(required).toContain("add a password first");
  });

  it("styles OIDC consent through the shared hosted shell", () => {
    const html = buildOidcConsentHtml({
      clientName: "LAX Shop Web",
      scopes: ["openid", "profile"],
      code: "opaque-consent-code",
    });
    expect(html).toContain('class="panel"');
    expect(html).toContain("Authorise LAX Shop Web");
    expect(html).toContain('value="opaque-consent-code"');
    expect(html).toContain('class="actions"');
    expect(html).toContain("btn btn-primary");
    expect(html).toContain("btn btn-secondary");
    expect(html).toContain('<script src="/oidc-consent.js');
    expect(html).toContain("Continue to <strong>LAX Shop</strong>");
  });

  it("uses the shared hosted tokens for CTA and page shell", () => {
    expect(HOSTED_AUTH_STYLES).toContain("--color-cta-bg: #0f766e");
    expect(HOSTED_AUTH_STYLES).toContain("--color-page-bg: #ffffff");
    expect(HOSTED_AUTH_STYLES).toContain("--auth-column: 528px");
    expect(HOSTED_AUTH_STYLES).toContain("Montserrat");
    expect(HOSTED_AUTH_STYLES).toContain("--control-min: 2.75rem");
  });

  it("wears the LAX Account lockup and names the Shop as the destination for lax-shop-web", () => {
    const view = hostedAuthViewFromSearch(shopSearch, shopCapabilities);
    const html = buildHostedLoginHtml(view);
    expect(html).toContain("/hosted-auth/lockups/lax-account.svg");
    expect(html).toContain('<p class="product-chip">Continue to <strong>LAX Shop</strong></p>');
    expect(html).not.toContain("lax-shop.svg");
    expect(html).toContain("Sign in with your LAX Account.");
    expect(textOf(html)).toContain("One LAX Account for Bid, Shop and lax.art.");
    expect(html).toContain("Continue with Google");
    expect(html).toContain('class="btn-mark"');
    expect(html).toContain('class="btn-label"');
    expect(html).not.toContain("Continue with Apple");
    expect(html).not.toMatch(/style=/);
    expect(html).toContain('data-email-first="true"');
    expect(html).toContain('data-login-step="email"');
    expect(html).toContain('data-login-step="credentials"');
    expect(html).toContain('data-login-step="magic-link-sent"');
    expect(html).toContain("Forgot password?");
    expect(html).toContain("Email me a sign-in link instead");
    expect(html).not.toContain("Sign in with phone number");
    expect(html).toContain('href="/forgot-password?client_id=lax-shop-web"');
    expect(html).not.toMatch(/href="\/[^"]*code_challenge/);
    expect(html).not.toMatch(/href="\/[^"]*state=/);
    expect(html).toContain("data-password-toggle");
    expect(html).toContain("btn-reveal");
    expect(html).toContain("Email address");
    expect(html).not.toContain("lax-bid.svg");
    expect(html).toContain("turnstile-host");
    expect(html).not.toContain("challenges.cloudflare.com");
    expect(view.config.authorizeResumePath).toContain("code_challenge=");
    expect(view.config.loginPath).toBe("/login?client_id=lax-shop-web");
  });

  it("renders social sign-up actions when providers are enabled", () => {
    const view = hostedAuthViewFromSearch(shopSearch, shopCapabilities);
    const html = buildHostedSignUpHtml(view);
    expect(html).toContain("Continue with Google");
    expect(html).toContain('data-social-provider="google"');
    expect(html).not.toMatch(/style=/);
  });

  it("keeps the combined email/password mode behind issuer configuration", () => {
    const view = hostedAuthViewFromSearch(shopSearch, { ...shopCapabilities, emailFirst: false });
    const html = buildHostedLoginHtml(view);
    expect(html).toContain('data-email-first="false"');
    expect(html).not.toContain('data-login-step="email"');
    expect(html).toContain("Email address");
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

describe("one-account message", () => {
  const accountCapabilities = { ...shopCapabilities, accountOrigin: "https://account.example/" };

  it("links Learn more to the Account landing page on sign-in and sign-up", () => {
    const view = hostedAuthViewFromSearch(shopSearch, accountCapabilities);
    for (const html of [buildHostedLoginHtml(view), buildHostedSignUpHtml(view)]) {
      expect(textOf(html)).toContain("One LAX Account for Bid, Shop and lax.art.");
      expect(html).toContain('href="https://account.example/">Learn more</a>');
    }
  });

  it("omits the link, not the message, when the Account origin is not configured", () => {
    const html = buildHostedSignUpHtml(hostedAuthViewFromSearch(shopSearch, shopCapabilities));
    expect(textOf(html)).toContain("One LAX Account for Bid, Shop and lax.art.");
    expect(html).not.toContain("Learn more");
  });
});

describe("one-account product names", () => {
  it("sets each product in the note in its own colour", () => {
    const html = buildHostedLoginHtml(hostedAuthViewFromSearch(shopSearch, shopCapabilities));
    expect(html).toContain('<span class="product-name product-name--bid">Bid</span>');
    expect(html).toContain('<span class="product-name product-name--shop">Shop</span>');
    expect(html).toContain('<span class="product-name product-name--art">lax.art</span>');
  });
});

describe("hosted colour rule", () => {
  it("never uses Bid's navy for links or focus rings", () => {
    // Navy appears once per theme, as the colour of Bid's name in the one-account note.
    const navy = HOSTED_AUTH_STYLES.split("\n").filter((line) => /#091f5b|#a5b7e9/i.test(line));
    expect(navy.map((line) => line.trim())).toEqual([
      "--color-product-bid: #091f5b;",
      "--color-product-bid: #a5b7e9;",
    ]);
    expect(HOSTED_AUTH_STYLES).not.toMatch(/#202759|midnight/i);
    expect(HOSTED_AUTH_STYLES).toContain("--color-ring: #0f766e");
    expect(HOSTED_AUTH_STYLES).toContain("--color-ring: #2dd4bf");
    expect(HOSTED_AUTH_STYLES).toContain("--color-link: #191919");
  });

  it("looks the same for Bid except for the chip", () => {
    const bid = buildHostedLoginHtml(
      hostedAuthViewFromSearch("client_id=lax-bid-web", shopCapabilities),
    );
    expect(bid).toContain("/hosted-auth/lockups/lax-account.svg");
    expect(bid).toContain("Continue to <strong>LAX Bid</strong>");
    expect(bid).not.toContain("lax-bid.svg");
    expect(bid).not.toContain("theme-bid");
  });
});

const shopAdminSearch =
  "response_type=code&client_id=lax-shop-admin&redirect_uri=http://localhost:3030/api/auth/callback&scope=openid&state=abc&nonce=def&code_challenge=challenge&code_challenge_method=S256";

describe("Shop Admin hosted login", () => {
  it("renders staff-only login chrome with logo and tagline", () => {
    const view = hostedAuthViewFromSearch(shopAdminSearch, shopCapabilities);
    const html = buildHostedLoginHtml(view);
    expect(html).toContain("/hosted-auth/lockups/lax-account.svg");
    expect(html).toContain("brand-tagline");
    expect(html).toContain("Shop Admin");
    expect(html).toContain("Staff sign-in for LAX Shop Admin.");
    expect(html).toContain("staff-access-note");
    expect(html).not.toContain("Continue with Google");
    expect(html).not.toContain("Email me a sign-in link instead");
    expect(html).not.toContain("Sign in with phone number");
    expect(html).not.toContain("Don't have an account?");
    expect(html).toContain("<title>Sign in · LAX Account</title>");
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
