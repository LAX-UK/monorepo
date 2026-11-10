import {
  SOCIAL_PROVIDER_MARK_PATHS,
  type SocialSignInProvider,
} from "@auction/identity-contracts/account";

/**
 * The Google and Apple marks beside a sign-in method, in the providers' own colours (Apple's takes
 * the text colour, so it reads on light and dark). The paths are shared with the hosted sign-in
 * page's buttons.
 */
export function ProviderMark({ provider }: { provider: SocialSignInProvider }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      data-provider-mark={provider}
    >
      {SOCIAL_PROVIDER_MARK_PATHS[provider].map((path) => (
        <path
          key={path.d}
          d={path.d}
          fill={path.fill ?? "currentColor"}
          className={path.fill ? undefined : "text-on-surface"}
        />
      ))}
    </svg>
  );
}
