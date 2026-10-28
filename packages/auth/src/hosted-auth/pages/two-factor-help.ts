import { HOSTED_COPY } from "../copy.js";
import { continuationHref } from "../flow-context.js";
import { buildHostedAuthHtml, escapeHostedHtml, viewChrome } from "../html.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

/** Bid's contact page, as LAX Account's help links to it. */
export const HOSTED_SUPPORT_CONTACT_PATH = "/contact";

/**
 * Where to go when the authenticator app and the backup codes are both gone. Two-step
 * verification cannot be skipped by the person alone, so this page only explains the way back:
 * support resets it after checking identity, and the person sets it up again after signing in.
 */
export function buildHostedTwoFactorHelpHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  const contactUrl = `${view.capabilities.bidOrigin.replace(/\/$/, "")}${HOSTED_SUPPORT_CONTACT_PATH}`;
  const backHref = continuationHref("/two-factor", view.flow);
  return buildHostedAuthHtml({
    title: `Lost access to your ${HOSTED_COPY.twoStep.app}?`,
    description: `If you can't get a code and have no backup codes left, LAX support can reset ${HOSTED_COPY.twoStep.name} for you.`,
    ...viewChrome(view),
    body: `<div class="auth-stack">
      <ol class="auth-hint">
        <li>Contact LAX support from the email address on your account.</li>
        <li>We'll check it's really you before we change anything.</li>
        <li>Once it's reset, sign in with your password and set up ${HOSTED_COPY.twoStep.name} again.</li>
      </ol>
      <a class="btn btn-primary" id="two-factor-help-contact" href="${escapeHostedHtml(contactUrl)}" rel="noopener">Contact support</a>
      <p class="links-secondary">Found a backup code? <a class="text-link" href="${escapeHostedHtml(backHref)}">Go back and use it</a></p>
    </div>`,
  });
}
