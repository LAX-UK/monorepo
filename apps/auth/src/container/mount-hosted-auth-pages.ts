import {
  type HostedAccountChooserIntent,
  type HostedAuthCapabilities,
  type TwoFactorSetupRequiredBy,
  buildHostedAccountChooserHtml,
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedMagicLinkHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorHelpHtml,
  buildHostedTwoFactorHtml,
  buildHostedTwoFactorManageHtml,
  buildHostedTwoFactorSetupHtml,
  buildHostedVerifyEmailHtml,
  continuationHref,
  hostedAuthViewFromSearch,
  hostedSignUpRequested,
  parseTwoFactorSetupRequiredBy,
} from "@auction/auth";
import type { Context, Hono } from "hono";
import { applyHostedAuthCspNonce } from "../lib/apply-hosted-auth-csp-nonce.js";
import { HOSTED_AUTH_CSP_NONCE_KEY } from "../middleware/security-headers.js";
import type { TwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";

function hostedAuthHtml(c: Context, html: string): Response {
  const nonce = c.get(HOSTED_AUTH_CSP_NONCE_KEY);
  const body = typeof nonce === "string" ? applyHostedAuthCspNonce(html, nonce) : html;
  return c.html(body);
}

export type HostedAuthPageMountOptions = HostedAuthCapabilities & {
  getSession?: (headers: Headers) => Promise<unknown>;
  readTwoFactorRequirement?: TwoFactorRequirementReader;
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

function sessionIdentity(session: unknown): { name: string; email: string } | null {
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: { name?: unknown; email?: unknown } }).user;
  if (typeof user?.email !== "string" || user.email.length === 0) return null;
  return { name: typeof user.name === "string" ? user.name : "", email: user.email };
}

/**
 * An explicit visit to the sign-in or sign-up page from a browser that already holds an issuer
 * session. It asks "continue as this person, or use a different account" instead of signing in
 * silently, so a shared or borrowed device never becomes the previous person's session because
 * someone pressed Sign in.
 *
 * Only an explicit page visit lands here. Silent single sign-on between products, and
 * `prompt=none`, run inside the authorize request, which completes with the existing session
 * and never renders these pages. An authorize request that does need a sign-in arrives with its
 * full OIDC parameters (`authorizeResumePath`) or Better Auth's `oidc_login_prompt` cookie, and
 * must reach the real form: the person is mid-flow, and that includes `prompt=login`, which
 * asks for a fresh sign-in.
 */
async function accountChooserIfSignedIn(
  c: Context,
  capabilities: HostedAuthPageMountOptions,
  intent: HostedAccountChooserIntent,
): Promise<Response | null> {
  if (hasOidcLoginPromptCookie(c.req.header("cookie"))) return null;
  const view = viewFromRequest(c.req.url, capabilities);
  if (view.config.authorizeResumePath) return null;
  if (!isConfiguredRestartUrl(view.config.restartUrl)) return null;
  if (!capabilities.getSession) return null;
  try {
    const identity = sessionIdentity(await capabilities.getSession(c.req.raw.headers));
    if (!identity) return null;
    c.header("Cache-Control", "no-store");
    return hostedAuthHtml(
      c,
      buildHostedAccountChooserHtml(
        {
          intent,
          ...identity,
          continueUrl: view.config.restartUrl,
          switchUrl:
            intent === "sign-up" ? continuationHref("/sign-up", view.flow) : view.flow.loginPath,
        },
        view,
      ),
    );
  } catch {
    return null;
  }
}

function sessionHasTwoFactor(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const user = (session as { user?: { twoFactorEnabled?: unknown } }).user;
  return user?.twoFactorEnabled === true;
}

function sessionSubjectId(session: unknown): string | null {
  if (!session || typeof session !== "object") return null;
  const id = (session as { user?: { id?: unknown } }).user?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function manageUrl(requestUrl: string): string {
  const params = new URL(requestUrl).searchParams;
  params.delete("required_by");
  const query = params.toString();
  return `/two-factor/manage${query ? `?${query}` : ""}`;
}

/** Display only: `/two-factor/disable` enforces the policy on the server either way. */
async function policyRequiredBy(
  capabilities: HostedAuthPageMountOptions,
  subjectId: string,
): Promise<TwoFactorSetupRequiredBy[]> {
  if (!capabilities.readTwoFactorRequirement) return [];
  try {
    const requirement = await capabilities.readTwoFactorRequirement(subjectId);
    if (!requirement.required) return [];
    return [...new Set(requirement.sources.map((source) => source.scope))];
  } catch {
    return [];
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

  const html = (
    path: string,
    render: typeof buildHostedLoginHtml,
    chooserIntent?: HostedAccountChooserIntent,
  ) => {
    app.get(path, async (c) => {
      const staffRedirect = redirectStaffCustomerPaths(c, capabilities);
      if (staffRedirect) return staffRedirect;
      if (chooserIntent) {
        const chooser = await accountChooserIfSignedIn(c, capabilities, chooserIntent);
        if (chooser) return chooser;
      }
      c.header("Cache-Control", "no-store");
      return hostedAuthHtml(c, render(viewFromRequest(c.req.url, capabilities)));
    });
  };

  app.get("/login", async (c) => {
    const url = new URL(c.req.url);
    if (hostedSignUpRequested(url.searchParams)) {
      return c.redirect(`/sign-up${url.search}`, 302);
    }
    const chooser = await accountChooserIfSignedIn(c, capabilities, "sign-in");
    if (chooser) return chooser;
    c.header("Cache-Control", "no-store");
    return hostedAuthHtml(c, buildHostedLoginHtml(viewFromRequest(c.req.url, capabilities)));
  });
  html("/sign-up", buildHostedSignUpHtml, "sign-up");
  html("/forgot-password", buildHostedForgotPasswordHtml);
  html("/reset-password", buildHostedResetPasswordHtml);
  html("/two-factor", buildHostedTwoFactorHtml);
  html("/two-factor/help", buildHostedTwoFactorHelpHtml);
  app.get("/two-factor/setup", async (c) => {
    const view = viewFromRequest(c.req.url, capabilities);
    const requiredBy = parseTwoFactorSetupRequiredBy(
      new URL(c.req.url).searchParams.get("required_by"),
    );
    c.header("Cache-Control", "no-store");
    if (!capabilities.getSession)
      return hostedAuthHtml(c, buildHostedTwoFactorSetupHtml(view, requiredBy));
    let session: unknown;
    try {
      session = await capabilities.getSession(c.req.raw.headers);
    } catch {
      return hostedAuthHtml(c, buildHostedTwoFactorSetupHtml(view, requiredBy));
    }
    if (!session) return c.redirect(view.flow.loginPath, 302);
    // Enabling again would immediately replace the working authenticator secret.
    if (sessionHasTwoFactor(session)) return c.redirect(manageUrl(c.req.url), 302);
    return hostedAuthHtml(c, buildHostedTwoFactorSetupHtml(view, requiredBy));
  });
  app.get("/two-factor/manage", async (c) => {
    const view = viewFromRequest(c.req.url, capabilities);
    c.header("Cache-Control", "no-store");
    let session: unknown = null;
    try {
      session = capabilities.getSession ? await capabilities.getSession(c.req.raw.headers) : null;
    } catch {
      session = null;
    }
    const subjectId = sessionSubjectId(session);
    if (!subjectId) return c.redirect(view.flow.loginPath, 302);
    if (!sessionHasTwoFactor(session)) {
      return c.redirect(`/two-factor/setup${new URL(c.req.url).search}`, 302);
    }
    return hostedAuthHtml(
      c,
      buildHostedTwoFactorManageHtml(view, await policyRequiredBy(capabilities, subjectId)),
    );
  });
  html("/verify-email", buildHostedVerifyEmailHtml);
  html("/resend-verification", buildHostedResendVerificationHtml);
  html("/magic-link", buildHostedMagicLinkHtml);
  // Phone sign-in retired: contact verification uses account settings / LAX Account only.
}
