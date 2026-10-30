import { oneAccountSection } from "../chrome.js";
import { HOSTED_COPY } from "../copy.js";
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
import { hostedAgreementLinks } from "../legal-links.js";
import { HOSTED_AUTH_ASSET_VERSION, HOSTED_AUTH_POLICY } from "../policy.js";
import { socialActions } from "../social-actions.js";
import {
  type HostedAuthView,
  hostedAuthViewFromSearch,
  resolveHostedProductBackLink,
} from "../view.js";

export { HOSTED_SIGN_UP_SCRIPT } from "../scripts.js";

/** "By creating an account you agree to the Terms and Privacy notice", for the product's company. */
function agreementLine(view: HostedAuthView): string {
  const links = hostedAgreementLinks(view.flow.product, view.capabilities);
  const copy = HOSTED_COPY.signUpAgreement;
  const link = (href: string, label: string) =>
    `<a class="text-link" href="${escapeHostedHtml(href)}">${escapeHostedHtml(label)}</a>`;
  return `<p class="auth-fineprint">${escapeHostedHtml(copy.lead)} ${link(links.terms, copy.terms)} and ${link(links.privacy, copy.privacy)}.</p>`;
}

export function buildHostedSignUpHtml(view: HostedAuthView = hostedAuthViewFromSearch("")): string {
  const productBack = resolveHostedProductBackLink(view);
  return buildHostedAuthHtml({
    title: `Create your ${HOSTED_COPY.accountName}`,
    lead: "signUp",
    ...viewChrome(view),
    body: `<div id="signup-root" class="auth-stack">
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
      ${agreementLine(view)}
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
