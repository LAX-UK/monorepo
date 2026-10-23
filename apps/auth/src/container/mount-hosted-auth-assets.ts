import {
  HOSTED_AUTH_FAVICON_BASE_PATH,
  HOSTED_AUTH_RUNTIME_SCRIPT,
  HOSTED_AUTH_STYLES,
  HOSTED_FAVICON_ASSET_NAMES,
  HOSTED_FONT_ASSET_DIR,
  HOSTED_FONT_BASE_PATH,
  HOSTED_FONT_FILES,
  HOSTED_FORGOT_PASSWORD_SCRIPT,
  HOSTED_LOCKUP_ASSET_DIR,
  HOSTED_LOCKUP_BASE_PATH,
  HOSTED_LOGIN_SCRIPT,
  HOSTED_MAGIC_LINK_SCRIPT,
  HOSTED_RESEND_VERIFICATION_SCRIPT,
  HOSTED_RESET_PASSWORD_SCRIPT,
  HOSTED_SIGN_UP_SCRIPT,
  HOSTED_TWO_FACTOR_MANAGE_SCRIPT,
  HOSTED_TWO_FACTOR_SCRIPT,
  HOSTED_TWO_FACTOR_SETUP_SCRIPT,
  HOSTED_VERIFY_EMAIL_SCRIPT,
  OIDC_CONSENT_SCRIPT,
  hostedFaviconContentType,
  hostedLockupFilename,
  readHostedAssetBytes,
  readHostedFaviconBytes,
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
    ["/hosted-two-factor-setup.js", HOSTED_TWO_FACTOR_SETUP_SCRIPT],
    ["/hosted-two-factor-manage.js", HOSTED_TWO_FACTOR_MANAGE_SCRIPT],
    ["/hosted-verify-email.js", HOSTED_VERIFY_EMAIL_SCRIPT],
    ["/hosted-resend-verification.js", HOSTED_RESEND_VERIFICATION_SCRIPT],
    ["/hosted-magic-link.js", HOSTED_MAGIC_LINK_SCRIPT],
    ["/oidc-consent.js", OIDC_CONSENT_SCRIPT],
  ];
  app.get("/hosted-auth.css", (c) => {
    c.header("Cache-Control", cache);
    return c.body(HOSTED_AUTH_STYLES, 200, {
      "Content-Type": "text/css; charset=utf-8",
    });
  });
  const lockupFiles = [hostedLockupFilename("light"), hostedLockupFilename("dark")];
  for (const file of lockupFiles) {
    app.get(`${HOSTED_LOCKUP_BASE_PATH}/${file}`, (c) => {
      c.header("Cache-Control", cache);
      return c.body(
        new Uint8Array(readHostedAssetBytes(`${HOSTED_LOCKUP_ASSET_DIR}/${file}`)),
        200,
        {
          "Content-Type": "image/svg+xml; charset=utf-8",
        },
      );
    });
  }
  for (const file of Object.values(HOSTED_FONT_FILES)) {
    app.get(`${HOSTED_FONT_BASE_PATH}/${file}`, (c) => {
      c.header("Cache-Control", cache);
      return c.body(new Uint8Array(readHostedAssetBytes(`${HOSTED_FONT_ASSET_DIR}/${file}`)), 200, {
        "Content-Type": "font/woff2",
      });
    });
  }
  for (const name of HOSTED_FAVICON_ASSET_NAMES) {
    const path = `${HOSTED_AUTH_FAVICON_BASE_PATH}/${name}`;
    app.get(path, (c) => {
      c.header("Cache-Control", cache);
      const body = readHostedFaviconBytes(name);
      return c.body(new Uint8Array(body), 200, {
        "Content-Type": hostedFaviconContentType(name),
      });
    });
  }
  for (const [path, body] of scripts) {
    app.get(path, (c) => {
      c.header("Cache-Control", cache);
      return c.body(body, 200, {
        "Content-Type": "text/javascript; charset=utf-8",
      });
    });
  }
}
