import {
  type HostedAuthCapabilities,
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedMagicLinkHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorAlreadyEnabledHtml,
  buildHostedTwoFactorHtml,
  buildHostedTwoFactorSetupHtml,
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

function sessionHasTwoFactor(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const user = (session as { user?: { twoFactorEnabled?: unknown } }).user;
  return user?.twoFactorEnabled === true;
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
  app.get("/two-factor/setup", async (c) => {
    const view = viewFromRequest(c.req.url, capabilities);
    c.header("Cache-Control", "no-store");
    if (!capabilities.getSession) return c.html(buildHostedTwoFactorSetupHtml(view));
    let session: unknown;
    try {
      session = await capabilities.getSession(c.req.raw.headers);
    } catch {
      return c.html(buildHostedTwoFactorSetupHtml(view));
    }
    if (!session) return c.redirect(view.flow.loginPath, 302);
    // Enabling again would immediately replace the working authenticator secret.
    if (sessionHasTwoFactor(session)) {
      return c.html(buildHostedTwoFactorAlreadyEnabledHtml(view));
    }
    return c.html(buildHostedTwoFactorSetupHtml(view));
  });
  html("/verify-email", buildHostedVerifyEmailHtml);
  html("/resend-verification", buildHostedResendVerificationHtml);
  html("/magic-link", buildHostedMagicLinkHtml);
  // Phone sign-in retired: contact verification uses account settings / LAX Account only.
}
