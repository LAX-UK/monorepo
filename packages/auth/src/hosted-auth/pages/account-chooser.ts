import { HOSTED_COPY } from "../copy.js";
import {
  buildHostedAuthHtml,
  escapeHostedHtml,
  hostedButton,
  statusRegions,
  viewChrome,
} from "../html.js";
import { maskEmail } from "../mask-email.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_ACCOUNT_CHOOSER_SCRIPT } from "../scripts.js";

/** The explicit page the person asked for; "Use a different account" returns to it signed out. */
export type HostedAccountChooserIntent = "sign-in" | "sign-up";

export type HostedAccountChooserInput = {
  intent: HostedAccountChooserIntent;
  name: string;
  email: string;
  /** Where "Continue" goes: the product that sent the person here. */
  continueUrl: string;
  /** The sign-in or sign-up page, with the same client and return parameters. */
  switchUrl: string;
};

/**
 * Asked before a browser that already holds an issuer session is signed in again. A shared or
 * borrowed device must not silently become the previous person's session just because someone
 * pressed Sign in. Silent single sign-on between products does not come through here: it runs
 * inside the authorize request and never renders a hosted page.
 */
export function buildHostedAccountChooserHtml(
  input: HostedAccountChooserInput,
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  const name = input.name.trim() || HOSTED_COPY.accountName;
  return buildHostedAuthHtml({
    title: `Continue as ${name}?`,
    description: `This device is signed in to ${maskEmail(input.email)}. Not you? Use a different account.`,
    ...viewChrome(view),
    body: `<div id="account-chooser" class="auth-stack" data-intent="${escapeHostedHtml(input.intent)}" data-switch-href="${escapeHostedHtml(input.switchUrl)}">
      <div class="auth-form">
        <a class="btn btn-primary" id="chooser-continue" href="${escapeHostedHtml(input.continueUrl)}">Continue</a>
        ${hostedButton({
          id: "chooser-switch",
          type: "button",
          kind: "secondary",
          label: "Use a different account",
          loadingLabel: "Signing out…",
        })}
      </div>
      ${statusRegions()}
    </div>`,
    scriptSrc: "/hosted-account-chooser.js",
  });
}
