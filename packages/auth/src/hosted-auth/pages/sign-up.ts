import { HOSTED_COPY } from "../copy.js";
import {
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  oneAccountNote,
  passwordField,
  statusRegions,
  turnstileHost,
} from "../html.js";
import { HOSTED_AUTH_POLICY } from "../policy.js";
import { socialActions } from "../social-actions.js";
import {
  type HostedAuthView,
  hostedAuthViewFromSearch,
  resolveHostedProductBackLink,
} from "../view.js";

export { HOSTED_SIGN_UP_SCRIPT } from "../scripts.js";

export function buildHostedSignUpHtml(view: HostedAuthView = hostedAuthViewFromSearch("")): string {
  const productBack = resolveHostedProductBackLink(view);
  return buildHostedAuthHtml({
    title: `Create your ${HOSTED_COPY.accountName}`,
    description: "Create an account once and use it across LAX.",
    brand: view.brand,
    config: view.config,
    body: `<div id="signup-root" class="auth-stack">
      ${socialActions(view)}
      <form id="signup-form" class="auth-form" novalidate>
      ${floatingInput({ id: "name", label: "Full name", autocomplete: "name" })}
      ${floatingInput({ id: "email", label: "Email address", type: "email", autocomplete: "username" })}
      ${passwordField({
        id: "password",
        label: "Password",
        autocomplete: "new-password",
        minlength: HOSTED_AUTH_POLICY.passwordMinLength,
        maxlength: HOSTED_AUTH_POLICY.passwordMaxLength,
      })}
      ${hostedButton({ label: "Create account", loadingLabel: "Creating account…" })}
      ${turnstileHost()}
      ${statusRegions()}
      <div class="links">${continuationAnchor("Already have an account?", "/login", view.flow)}</div>
    </form>
    ${oneAccountNote(view.capabilities.accountOrigin)}</div>`,
    scriptSrc: "/hosted-sign-up.js",
    ...(productBack ? { productBack } : {}),
  });
}
