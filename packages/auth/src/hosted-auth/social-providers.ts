import { SOCIAL_PROVIDER_MARK_PATHS } from "@auction/identity-contracts";

/** Inline SVG marks, drawn from the paths shared with LAX Account. */

export type SocialProviderId = "google" | "apple";

export type SocialProviderDefinition = {
  label: string;
  busyLabel: string;
  mark: string;
};

function markSvg(provider: SocialProviderId): string {
  const paths = SOCIAL_PROVIDER_MARK_PATHS[provider]
    .map((path) => `<path fill="${path.fill ?? "currentColor"}" d="${path.d}"/>`)
    .join("");
  return `<svg class="btn-mark" aria-hidden="true" focusable="false" viewBox="0 0 24 24">${paths}</svg>`;
}

export const SOCIAL_PROVIDERS: Record<SocialProviderId, SocialProviderDefinition> = {
  google: {
    label: "Continue with Google",
    busyLabel: "Redirecting to Google…",
    mark: markSvg("google"),
  },
  apple: {
    label: "Continue with Apple",
    busyLabel: "Redirecting to Apple…",
    mark: markSvg("apple"),
  },
};
