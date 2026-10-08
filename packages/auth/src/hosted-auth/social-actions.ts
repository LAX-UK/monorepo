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

export function socialActions(view: HostedAuthView): string {
  const social = (
    [
      view.capabilities.googleEnabled ? socialProviderButton("google") : "",
      view.capabilities.appleEnabled ? socialProviderButton("apple") : "",
    ] as const
  )
    .filter(Boolean)
    .join("");
  return social
    ? `<div class="social-actions" data-login-chrome="methods">${social}${authDivider()}</div>`
    : "";
}
