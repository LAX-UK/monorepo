import { type AgreementCopy, agreementLine } from "./agreement-line.js";
import { authDivider, hostedButton } from "./html.js";
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

/** `agreement` adds the Terms statement under the buttons, for pages where they can create an account. */
export function socialActions(view: HostedAuthView, agreement?: AgreementCopy): string {
  if (view.flow.audience === "staff") return "";
  const social = (
    [
      view.capabilities.googleEnabled ? socialProviderButton("google") : "",
      view.capabilities.appleEnabled ? socialProviderButton("apple") : "",
    ] as const
  )
    .filter(Boolean)
    .join("");
  return social
    ? `<div class="social-actions" data-login-chrome="methods">${social}${agreement ? agreementLine(view, agreement) : ""}${authDivider()}</div>`
    : "";
}
