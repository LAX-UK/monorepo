"use client";

import { ProviderMark } from "@/components/auth/provider-mark";
import { authClient } from "@/lib/auth-client";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

type Props = {
  next?: string;
};

/** Public env flag — Apple sign-in is opt-in because it requires the
 * server-side client secret + domain-association file to be in place.
 */
const APPLE_ENABLED = process.env.NEXT_PUBLIC_APPLE_ENABLED === "true";

type SupportedProvider = "google" | "apple";

const PROVIDER_LABEL: Record<SupportedProvider, string> = {
  google: "Google",
  apple: "Apple",
};

export function SocialSignInButtons({ next = "/dashboard" }: Props) {
  const [pending, setPending] = useState<SupportedProvider | null>(null);

  const signInWith = async (provider: SupportedProvider) => {
    setPending(provider);
    const webOrigin = window.location.origin;
    const safeNext = isSafeNextPath(next) ? next : "/dashboard";
    const callbackParams = new URLSearchParams({ next: safeNext });
    const { data, error } = await authClient.signIn.social({
      provider,
      callbackURL: `${webOrigin}/auth/social-callback?${callbackParams.toString()}`,
      errorCallbackURL: `${webOrigin}/login?social_error=1`,
      disableRedirect: true,
    });
    if (error) {
      setPending(null);
      window.location.replace("/login?social_error=1");
      return;
    }
    const redirectUrl = (data as { url?: string } | null | undefined)?.url;
    if (redirectUrl) {
      // Replace (not assign) so Back from the provider skips the pre-OAuth /login page.
      window.location.replace(redirectUrl);
      return;
    }
    setPending(null);
    window.location.replace("/login?social_error=1");
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondaryOutline"
        className="min-h-12 w-full gap-3 rounded-md border-outline-variant/40 bg-surface-container-low px-4 py-3 tracking-[0.08em] normal-case text-on-surface hover:bg-surface-container"
        disabled={pending !== null}
        aria-busy={pending === "google"}
        onClick={() => void signInWith("google")}
      >
        <ProviderMark provider="google" />
        {pending === "google"
          ? `Continuing with ${PROVIDER_LABEL.google}...`
          : `Continue with ${PROVIDER_LABEL.google}`}
      </Button>
      {APPLE_ENABLED ? (
        <Button
          type="button"
          variant="secondaryOutline"
          className="min-h-12 w-full gap-3 rounded-md border-outline-variant/40 bg-surface-container-low px-4 py-3 tracking-[0.08em] normal-case text-on-surface hover:bg-surface-container"
          disabled={pending !== null}
          aria-busy={pending === "apple"}
          onClick={() => void signInWith("apple")}
        >
          <ProviderMark provider="apple" />
          {pending === "apple"
            ? `Continuing with ${PROVIDER_LABEL.apple}...`
            : `Continue with ${PROVIDER_LABEL.apple}`}
        </Button>
      ) : null}
    </div>
  );
}
