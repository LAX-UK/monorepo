import {
  HOSTED_AUTH_RUNTIME_SCRIPT,
  HOSTED_AUTH_STYLES,
  HOSTED_FORGOT_PASSWORD_SCRIPT,
  HOSTED_LOGIN_SCRIPT,
  HOSTED_MAGIC_LINK_SCRIPT,
  HOSTED_PHONE_SCRIPT,
  HOSTED_RESEND_VERIFICATION_SCRIPT,
  HOSTED_RESET_PASSWORD_SCRIPT,
  HOSTED_SIGN_UP_SCRIPT,
  HOSTED_TWO_FACTOR_SCRIPT,
  HOSTED_VERIFY_EMAIL_SCRIPT,
  OIDC_CONSENT_SCRIPT,
  readHostedBidLogoSvg,
  readHostedShopLogoSvg,
} from "@auction/auth";
import type { Hono } from "hono";

export function mountHostedAuthAssets(app: Hono): void {
  const cache = "public, max-age=3600";
  const scripts: Array<[string, string]> = [
    ["/hosted-auth-runtime.js", HOSTED_AUTH_RUNTIME_SCRIPT],
    ["/hosted-login.js", HOSTED_LOGIN_SCRIPT],
    ["/hosted-sign-up.js", HOSTED_SIGN_UP_SCRIPT],
    ["/hosted-forgot-password.js", HOSTED_FORGOT_PASSWORD_SCRIPT],
    ["/hosted-reset-password.js", HOSTED_RESET_PASSWORD_SCRIPT],
    ["/hosted-two-factor.js", HOSTED_TWO_FACTOR_SCRIPT],
    ["/hosted-verify-email.js", HOSTED_VERIFY_EMAIL_SCRIPT],
    ["/hosted-resend-verification.js", HOSTED_RESEND_VERIFICATION_SCRIPT],
    ["/hosted-magic-link.js", HOSTED_MAGIC_LINK_SCRIPT],
    ["/hosted-phone.js", HOSTED_PHONE_SCRIPT],
    ["/oidc-consent.js", OIDC_CONSENT_SCRIPT],
  ];
  app.get("/hosted-auth.css", (c) => {
    c.header("Cache-Control", cache);
    return c.body(HOSTED_AUTH_STYLES, 200, {
      "Content-Type": "text/css; charset=utf-8",
    });
  });
  app.get("/hosted-auth/lax-shop-logo.svg", (c) => {
    c.header("Cache-Control", cache);
    return c.body(readHostedShopLogoSvg(), 200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
    });
  });
  app.get("/hosted-auth/lax-bid-logo.svg", (c) => {
    c.header("Cache-Control", cache);
    return c.body(readHostedBidLogoSvg(), 200, {
      "Content-Type": "image/svg+xml; charset=utf-8",
    });
  });
  for (const [path, body] of scripts) {
    app.get(path, (c) => {
      c.header("Cache-Control", cache);
      return c.body(body, 200, {
        "Content-Type": "text/javascript; charset=utf-8",
      });
    });
  }
}
