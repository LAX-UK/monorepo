import {
  authDivider,
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  passwordField,
  statusRegions,
  turnstileHost,
} from "../html.js";
import {
  type HostedAuthView,
  hostedAuthViewFromSearch,
  resolveHostedProductBackLink,
} from "../view.js";

export { HOSTED_LOGIN_SCRIPT } from "../scripts.js";

function socialActions(view: HostedAuthView): string {
  const social = [
    view.capabilities.googleEnabled
      ? hostedButton({
          label: "Continue with Google",
          type: "button",
          kind: "secondary",
          extraAttrs: { "data-social-provider": "google" },
        })
      : "",
    view.capabilities.appleEnabled
      ? hostedButton({
          label: "Continue with Apple",
          type: "button",
          kind: "secondary",
          extraAttrs: { "data-social-provider": "apple" },
        })
      : "",
  ]
    .filter(Boolean)
    .join("");
  return social
    ? `<div class="social-actions" data-login-chrome="methods">${social}${authDivider()}</div>`
    : "";
}

function phoneAndSignUp(view: HostedAuthView): string {
  const phone = view.capabilities.phoneEnabled
    ? continuationAnchor("Sign in with phone number", "/phone", view.flow)
    : "";
  const signUp = `<p class="lead">Don't have an account? ${continuationAnchor("Sign up", "/sign-up", view.flow)}</p>`;
  return `<div class="links" data-login-chrome="footer">${phone}${signUp}</div>`;
}

function emailFirstBody(view: HostedAuthView): string {
  return `<div id="login-root" class="auth-stack" data-email-first="true">
    ${socialActions(view)}
    <form id="login-form" class="auth-form" novalidate>
      <div class="auth-step" data-login-step="email">
        ${floatingInput({ id: "email", label: "Email Address", type: "email", autocomplete: "username" })}
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
        ${hostedButton({ label: "Sign In", loadingLabel: "Signing in…" })}
        ${hostedButton({
          label: "Email me a sign-in link instead",
          type: "button",
          kind: "secondary",
          id: "magic-link-instead",
          loadingLabel: "Sending…",
        })}
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
      ${floatingInput({ id: "email", label: "Email Address", type: "email", autocomplete: "username" })}
      ${passwordField({ id: "password", label: "Password", autocomplete: "current-password" })}
      <div class="field-row-end">${continuationAnchor("Forgot password?", "/forgot-password", view.flow)}</div>
      ${hostedButton({ label: "Sign In", loadingLabel: "Signing in…" })}
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
  return buildHostedAuthHtml({
    title: "Sign in",
    description: `Sign in to your ${view.brand.productName} account to continue.`,
    brand: view.brand,
    config: view.config,
    body: view.capabilities.emailFirst ? emailFirstBody(view) : combinedBody(view),
    scriptSrc: "/hosted-login.js",
    ...(productBack ? { productBack } : {}),
  });
}

export type { HostedLoginStep } from "../browser/login-state.js";
