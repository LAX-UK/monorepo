import { oneAccountSection } from "../chrome.js";
import {
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  passwordField,
  statusRegions,
  turnstileHost,
  viewChrome,
} from "../html.js";
import { HOSTED_AUTH_ASSET_VERSION } from "../policy.js";
import { socialActions } from "../social-actions.js";
import {
  type HostedAuthView,
  hostedAuthViewFromSearch,
  resolveHostedProductBackLink,
} from "../view.js";

export { HOSTED_LOGIN_SCRIPT } from "../scripts.js";

function phoneAndSignUp(view: HostedAuthView): string {
  if (view.flow.audience === "staff") {
    return `<p class="links-secondary staff-access-note">Access is limited to LAX staff accounts. Ask a Shop administrator if you need access.</p>`;
  }
  const signUp = `<p class="links-secondary">Don't have an account? ${continuationAnchor("Sign up", "/sign-up", view.flow)}</p>`;
  return `<div class="links links--stacked" data-login-chrome="footer">${signUp}</div>
    ${oneAccountSection(`?v=${HOSTED_AUTH_ASSET_VERSION}`)}`;
}

function magicLinkInsteadButton(view: HostedAuthView): string {
  if (view.flow.audience === "staff") return "";
  return hostedButton({
    label: "Email me a sign-in link instead",
    type: "button",
    kind: "secondary",
    id: "magic-link-instead",
    loadingLabel: "Sending…",
  });
}

function emailFirstBody(view: HostedAuthView): string {
  return `<div id="login-root" class="auth-stack" data-email-first="true">
    ${socialActions(view)}
    <form id="login-form" class="auth-form" novalidate>
      <div class="auth-step" data-login-step="email">
        ${floatingInput({ id: "email", label: "Email address", type: "email", autocomplete: "username", ...(view.flow.loginHint ? { value: view.flow.loginHint } : {}) })}
        ${hostedButton({ label: "Continue", loadingLabel: "Continue" })}
      </div>
      <div class="auth-step" data-login-step="credentials" hidden>
        <div class="email-summary">
          <span class="email-summary-label">Email</span>
          <div class="email-summary-row">
            <span id="email-summary-value" class="email-summary-value"></span>
            ${hostedButton({ label: "Change", type: "button", kind: "link", id: "change-email" })}
          </div>
        </div>
        ${passwordField({ id: "password", label: "Password", autocomplete: "current-password" })}
        <div class="field-row-end">${continuationAnchor("Forgot password?", "/forgot-password", view.flow)}</div>
        ${hostedButton({ label: "Sign in", loadingLabel: "Signing in…" })}
        ${magicLinkInsteadButton(view)}
      </div>
      <div class="auth-step" data-login-step="magic-link-sent" hidden>
        <p id="magic-link-confirmation" class="lead"></p>
        ${hostedButton({
          label: "Resend sign-in link",
          type: "button",
          kind: "secondary",
          id: "magic-link-resend",
          loadingLabel: "Sending…",
        })}
        ${hostedButton({ label: "Use a different email", type: "button", kind: "link", id: "different-email" })}
      </div>
      ${turnstileHost()}
      ${statusRegions()}
    </form>
    ${phoneAndSignUp(view)}
  </div>`;
}

function combinedBody(view: HostedAuthView): string {
  return `<div id="login-root" class="auth-stack" data-email-first="false">
    ${socialActions(view)}
    <form id="login-form" class="auth-form" novalidate>
      ${floatingInput({ id: "email", label: "Email address", type: "email", autocomplete: "username", ...(view.flow.loginHint ? { value: view.flow.loginHint } : {}) })}
      ${passwordField({ id: "password", label: "Password", autocomplete: "current-password" })}
      <div class="field-row-end">${continuationAnchor("Forgot password?", "/forgot-password", view.flow)}</div>
      ${hostedButton({ label: "Sign in", loadingLabel: "Signing in…" })}
      ${hostedButton({
        label: "Email me a sign-in link instead",
        type: "button",
        kind: "secondary",
        id: "magic-link-instead",
        loadingLabel: "Sending…",
      })}
      ${turnstileHost()}
      ${statusRegions()}
    </form>
    ${phoneAndSignUp(view)}
  </div>`;
}

export function buildHostedLoginHtml(view: HostedAuthView = hostedAuthViewFromSearch("")): string {
  const productBack = resolveHostedProductBackLink(view);
  // Staff sign-in names its tool in the lead; customers are told where they are heading.
  const lead =
    view.flow.audience === "staff"
      ? { description: "Staff sign-in for LAX Shop Admin.", showDestination: false }
      : { lead: "signIn" as const };
  return buildHostedAuthHtml({
    title: "Sign in",
    ...lead,
    ...viewChrome(view),
    body: view.capabilities.emailFirst ? emailFirstBody(view) : combinedBody(view),
    scriptSrc: "/hosted-login.js",
    ...(productBack ? { productBack } : {}),
  });
}

export type { HostedLoginStep } from "../browser/login-state.js";
