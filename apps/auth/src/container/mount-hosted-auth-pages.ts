import {
  type HostedAuthCapabilities,
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedMagicLinkHtml,
  buildHostedPhoneHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorHtml,
  buildHostedVerifyEmailHtml,
  hostedAuthViewFromSearch,
} from "@auction/auth";
import type { Context, Hono } from "hono";

export type HostedAuthPageMountOptions = HostedAuthCapabilities & {
  getSession?: (headers: Headers) => Promise<unknown>;
};

function viewFromRequest(url: string, capabilities: HostedAuthCapabilities) {
  return hostedAuthViewFromSearch(new URL(url).searchParams, capabilities);
}

function isConfiguredRestartUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

async function redirectSignedInIfNeeded(
  c: Context,
  capabilities: HostedAuthPageMountOptions,
): Promise<Response | null> {
  const view = viewFromRequest(c.req.url, capabilities);
  if (view.config.authorizeResumePath) return null;
  if (!isConfiguredRestartUrl(view.config.restartUrl)) return null;
  if (!capabilities.getSession) return null;
  try {
    const session = await capabilities.getSession(c.req.raw.headers);
    if (!session) return null;
    return c.redirect(view.config.restartUrl, 302);
  } catch {
    return null;
  }
}

export function mountHostedAuthPages(app: Hono, capabilities: HostedAuthPageMountOptions): void {
  const html = (path: string, render: typeof buildHostedLoginHtml, signedInRedirect = false) => {
    app.get(path, async (c) => {
      if (signedInRedirect) {
        const redirected = await redirectSignedInIfNeeded(c, capabilities);
        if (redirected) return redirected;
      }
      c.header("Cache-Control", "no-store");
      return c.html(render(viewFromRequest(c.req.url, capabilities)));
    });
  };

  html("/login", buildHostedLoginHtml, true);
  html("/sign-up", buildHostedSignUpHtml, true);
  html("/forgot-password", buildHostedForgotPasswordHtml);
  html("/reset-password", buildHostedResetPasswordHtml);
  html("/two-factor", buildHostedTwoFactorHtml);
  html("/verify-email", buildHostedVerifyEmailHtml);
  html("/resend-verification", buildHostedResendVerificationHtml);
  html("/magic-link", buildHostedMagicLinkHtml);
  if (capabilities.phoneEnabled) {
    html("/phone", buildHostedPhoneHtml);
  }
}
