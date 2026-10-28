import { HOSTED_AUTH_MESSAGES } from "../browser/messages.js";
import { HOSTED_COPY } from "../copy.js";
import { continuationHref } from "../flow-context.js";
import {
  buildHostedAuthHtml,
  continuationAnchor,
  escapeHostedHtml,
  floatingInput,
  hostedButton,
  newPasswordHint,
  passwordField,
  statusRegions,
  turnstileHost,
  viewChrome,
} from "../html.js";
import { HOSTED_AUTH_POLICY } from "../policy.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export {
  HOSTED_FORGOT_PASSWORD_SCRIPT,
  HOSTED_RESET_PASSWORD_SCRIPT,
} from "../scripts.js";

export function buildHostedForgotPasswordHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Reset password",
    description: "Enter your email and we will send reset instructions.",
    ...viewChrome(view),
    body: `<form id="forgot-form" class="auth-form" novalidate>
      ${floatingInput({ id: "email", label: "Email address", type: "email", autocomplete: "username" })}
      ${hostedButton({ label: "Send reset link", loadingLabel: "Sending…" })}
      ${turnstileHost()}
      ${statusRegions()}
      <div class="links">${continuationAnchor("Back to sign in", "/login", view.flow)}</div>
    </form>`,
    scriptSrc: "/hosted-forgot-password.js",
  });
}

export function buildHostedResetPasswordHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Choose new password",
    description: `Set a new password for your ${HOSTED_COPY.accountName}.`,
    ...viewChrome(view),
    body: `<div class="auth-stack">
    <form id="reset-form" class="auth-form" novalidate>
      ${passwordField({
        id: "password",
        label: "New password",
        autocomplete: "new-password",
        minlength: HOSTED_AUTH_POLICY.passwordMinLength,
        maxlength: HOSTED_AUTH_POLICY.passwordMaxLength,
        hint: newPasswordHint(),
      })}
      ${hostedButton({ label: "Update password", loadingLabel: "Updating…" })}
    </form>
    ${statusRegions()}
    <div id="reset-new-link" class="links" hidden>
      <a class="text-link" href="${escapeHostedHtml(continuationHref("/forgot-password", view.flow))}">${escapeHostedHtml(HOSTED_AUTH_MESSAGES.RESET_REQUEST_NEW_LINK)}</a>
    </div>
    </div>`,
    scriptSrc: "/hosted-reset-password.js",
  });
}
