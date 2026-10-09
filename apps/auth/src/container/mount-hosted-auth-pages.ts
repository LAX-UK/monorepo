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
  hostedSignUpRequested,
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

function hasOidcLoginPromptCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)oidc_login_prompt=/.test(cookieHeader);
}

async function redirectSignedInIfNeeded(
  c: Context,
  capabilities: HostedAuthPageMountOptions,
): Promise<Response | null> {
  if (hasOidcLoginPromptCookie(c.req.header("cookie"))) return null;
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

const STAFF_CUSTOMER_ONLY_PATHS = new Set(["/sign-up", "/phone", "/magic-link"]);

function redirectStaffCustomerPaths(
  c: Context,
  capabilities: HostedAuthCapabilities,
): Response | null {
  const path = new URL(c.req.url).pathname;
  if (!STAFF_CUSTOMER_ONLY_PATHS.has(path)) return null;
  const view = viewFromRequest(c.req.url, capabilities);
  if (view.flow.audience !== "staff") return null;
  return c.redirect(view.flow.loginPath, 302);
}

export function mountHostedAuthPages(app: Hono, capabilities: HostedAuthPageMountOptions): void {
  app.get("/", (c) => {
    const url = new URL(c.req.url);
    return c.redirect(`/login${url.search}`, 302);
  });

  const html = (path: string, render: typeof buildHostedLoginHtml, signedInRedirect = false) => {
    app.get(path, async (c) => {
      const staffRedirect = redirectStaffCustomerPaths(c, capabilities);
      if (staffRedirect) return staffRedirect;
      if (signedInRedirect) {
        const redirected = await redirectSignedInIfNeeded(c, capabilities);
        if (redirected) return redirected;
      }
      c.header("Cache-Control", "no-store");
      return c.html(render(viewFromRequest(c.req.url, capabilities)));
    });
  };

  app.get("/login", async (c) => {
    const url = new URL(c.req.url);
    if (hostedSignUpRequested(url.searchParams)) {
      return c.redirect(`/sign-up${url.search}`, 302);
    }
    const redirected = await redirectSignedInIfNeeded(c, capabilities);
    if (redirected) return redirected;
    c.header("Cache-Control", "no-store");
    return c.html(buildHostedLoginHtml(viewFromRequest(c.req.url, capabilities)));
  });
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
