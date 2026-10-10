import {
  type HostedAuthCapabilities,
  type TwoFactorSetupRequiredBy,
  buildHostedForgotPasswordHtml,
  buildHostedLoginHtml,
  buildHostedMagicLinkHtml,
  buildHostedResendVerificationHtml,
  buildHostedResetPasswordHtml,
  buildHostedSignUpHtml,
  buildHostedTwoFactorHtml,
  buildHostedTwoFactorManageHtml,
  buildHostedTwoFactorSetupHtml,
  buildHostedVerifyEmailHtml,
  hostedAuthViewFromSearch,
  hostedSignUpRequested,
  parseTwoFactorSetupRequiredBy,
} from "@auction/auth";
import type { Context, Hono } from "hono";
import type { TwoFactorRequirementReader } from "../services/two-factor-requirement.service.js";

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
    const requiredBy = parseTwoFactorSetupRequiredBy(
      new URL(c.req.url).searchParams.get("required_by"),
    );
    c.header("Cache-Control", "no-store");
    if (!capabilities.getSession) return c.html(buildHostedTwoFactorSetupHtml(view, requiredBy));
    let session: unknown;
    try {
      session = await capabilities.getSession(c.req.raw.headers);
    } catch {
      return c.html(buildHostedTwoFactorSetupHtml(view, requiredBy));
    }
    if (!session) return c.redirect(view.flow.loginPath, 302);
    // Enabling again would immediately replace the working authenticator secret.
    if (sessionHasTwoFactor(session)) return c.redirect(manageUrl(c.req.url), 302);
    return c.html(buildHostedTwoFactorSetupHtml(view, requiredBy));
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
    return c.html(
      buildHostedTwoFactorManageHtml(view, await policyRequiredBy(capabilities, subjectId)),
    );
  });
  html("/verify-email", buildHostedVerifyEmailHtml);
  html("/resend-verification", buildHostedResendVerificationHtml);
  html("/magic-link", buildHostedMagicLinkHtml);
  // Phone sign-in retired: contact verification uses account settings / LAX Account only.
}
