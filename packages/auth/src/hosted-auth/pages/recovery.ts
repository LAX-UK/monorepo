import {
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  passwordField,
  statusRegions,
  turnstileHost,
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
    brand: view.brand,
    config: view.config,
    body: `<form id="forgot-form" class="auth-form" novalidate>
      ${floatingInput({ id: "email", label: "Email Address", type: "email", autocomplete: "username" })}
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
    description: `Set a new password for your ${view.brand.productName} account.`,
    brand: view.brand,
    config: view.config,
    body: `<form id="reset-form" class="auth-form" novalidate>
      ${passwordField({
        id: "password",
        label: "New password",
        autocomplete: "new-password",
        minlength: HOSTED_AUTH_POLICY.passwordMinLength,
        maxlength: HOSTED_AUTH_POLICY.passwordMaxLength,
      })}
      ${hostedButton({ label: "Update password", loadingLabel: "Updating…" })}
      ${statusRegions()}
    </form>`,
    scriptSrc: "/hosted-reset-password.js",
  });
}
