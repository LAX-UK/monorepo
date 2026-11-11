import { type AgreementCopy, agreementLine } from "./agreement-line.js";
import { authDivider, hostedButton } from "./html.js";
import { passkeyButton, passkeyNote } from "./passkey-actions.js";
import { SOCIAL_PROVIDERS, type SocialProviderId } from "./social-providers.js";
import type { HostedAuthView } from "./view.js";

export function socialProviderButton(provider: SocialProviderId): string {
  const def = SOCIAL_PROVIDERS[provider];
  return hostedButton({
    label: def.label,
    type: "button",
    kind: "secondary",
    loadingLabel: def.busyLabel,
    leadingMark: def.mark,
    extraAttrs: { "data-social-provider": provider },
  });
}

/** Whether the passkey button belongs on this page: the sign-in pages only, never sign-up. */
export type SocialActionsOptions = { passkey?: boolean };

/**
 * The ways in that skip the email box: Google, Apple and a passkey, in that order, then the "or".
 * `agreement` adds the Terms statement under the buttons, for pages where they can create an
 * account. Staff never see Google or Apple. The passkey button is rendered hidden and shown by the
 * page script where the browser can use passkeys, so a block with nothing else in it stays hidden
 * too, with no stray "or".
 */
export function socialActions(
  view: HostedAuthView,
  agreement?: AgreementCopy,
  options: SocialActionsOptions = {},
): string {
  const staff = view.flow.audience === "staff";
  const providers = staff
    ? ""
    : [
        view.capabilities.googleEnabled ? socialProviderButton("google") : "",
        view.capabilities.appleEnabled ? socialProviderButton("apple") : "",
      ]
        .filter(Boolean)
        .join("");
  const passkey =
    options.passkey && view.capabilities.passkeysEnabled
      ? `${passkeyButton()}${passkeyNote()}`
      : "";
  if (!providers && !passkey) return "";
  const terms = !staff && agreement ? agreementLine(view, agreement) : "";
  // With only the passkey button inside, the block waits for the page script to say passkeys work.
  const hidden = providers ? "" : ' hidden data-methods-empty="true"';
  return `<div class="social-actions" data-login-chrome="methods"${hidden}>${providers}${passkey}${terms}${authDivider()}</div>`;
}
