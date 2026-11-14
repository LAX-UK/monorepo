import { agreementLine } from "../agreement-line.js";
import { contextLine, oneAccountSection } from "../chrome.js";
import { HOSTED_COPY } from "../copy.js";
import {
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  newPasswordHint,
  passwordField,
  statusRegions,
  turnstileHost,
  viewChrome,
} from "../html.js";
import { hostedLegalProduct } from "../legal-links.js";
import { HOSTED_AUTH_ASSET_VERSION, HOSTED_AUTH_POLICY } from "../policy.js";
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
    title: HOSTED_COPY.titles.signUp,
    contextLine: contextLine(view.brand.chip, view.flow.context),
    ...viewChrome(view),
    body: `<div id="signup-root" class="auth-stack" data-legal-product="${hostedLegalProduct(view.flow.product)}">
      ${socialActions(view)}
      <form id="signup-form" class="auth-form" novalidate>
      ${floatingInput({ id: "name", label: "Full name", autocomplete: "name" })}
      ${floatingInput({ id: "email", label: "Email address", type: "email", autocomplete: "username", ...(view.flow.loginHint ? { value: view.flow.loginHint } : {}) })}
      ${passwordField({
        id: "password",
        label: "Password",
        autocomplete: "new-password",
        minlength: HOSTED_AUTH_POLICY.passwordMinLength,
        maxlength: HOSTED_AUTH_POLICY.passwordMaxLength,
        hint: newPasswordHint(),
      })}
      ${agreementLine(view, HOSTED_COPY.signUpAgreement)}
      ${hostedButton({ label: "Create account", loadingLabel: "Creating account…" })}
      ${turnstileHost()}
      ${statusRegions()}
    </form>
    <div class="links links--stacked"><p class="links-secondary">Already have an account? ${continuationAnchor("Sign in", "/login", view.flow)}</p></div>
    ${oneAccountSection(`?v=${HOSTED_AUTH_ASSET_VERSION}`)}</div>`,
    scriptSrc: "/hosted-sign-up.js",
    ...(productBack ? { productBack } : {}),
  });
}
