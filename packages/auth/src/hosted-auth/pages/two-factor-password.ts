import { HOSTED_COPY } from "../copy.js";
import {
  buildHostedAuthHtml,
  continuationAnchor,
  escapeHostedHtml,
  hostedButton,
  statusRegions,
  viewChrome,
} from "../html.js";
import { maskEmail } from "../mask-email.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_TWO_FACTOR_PASSWORD_SCRIPT } from "../scripts.js";

/**
 * Shown when a policy asks for two-step verification and the person signs in with Google or
 * Apple only: there is no password to enrol an authenticator app with, so the page says what is
 * asked and starts the one step they can take, an emailed link to set a password. Nothing here
 * mentions any other way to meet the requirement.
 */
export function buildHostedTwoFactorPasswordHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
  person: { email: string } = { email: "" },
  requiredBy: "staff" | "org" | null = null,
): string {
  const asker = requiredBy === "staff" ? "LAX asks staff for" : "Your organisation asks for";
  return buildHostedAuthHtml({
    title: "Set a password to continue",
    description: `${asker} ${HOSTED_COPY.twoStep.name}. Set a password (we'll email you a link), then add an ${HOSTED_COPY.twoStep.app}.`,
    ...viewChrome(view),
    body: `<div class="auth-stack">
      <form id="password-link-form" class="auth-form" novalidate data-email="${escapeHostedHtml(person.email)}">
        <p class="auth-hint">We'll send the link to <strong>${escapeHostedHtml(maskEmail(person.email))}</strong>.</p>
        ${hostedButton({ id: "password-link-btn", label: "Email me a link", loadingLabel: "Sending…" })}
        ${statusRegions()}
      </form>
      <div class="links">${continuationAnchor("Use a different account", "/login", view.flow)}</div>
    </div>`,
    scriptSrc: "/hosted-two-factor-password.js",
  });
}
