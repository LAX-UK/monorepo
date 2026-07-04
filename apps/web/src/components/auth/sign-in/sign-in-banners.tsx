"use client";

import { FormBanner } from "@/components/auth/primitives/form-error";
import { SellAuthIntentBanner } from "@/components/auth/sell-auth-intent-banner";

type SignInBannersProps = {
  registered: boolean;
  reset: boolean;
  authRequired: boolean;
  verifyPending: string | null;
  sessionExpired: string | null;
  twofaRequired: string | null;
  bannerError: string | null;
  socialError: string | null;
};

export function SignInBanners({
  registered,
  reset,
  authRequired,
  verifyPending,
  sessionExpired,
  twofaRequired,
  bannerError,
  socialError,
}: SignInBannersProps) {
  return (
    <>
      {registered ? (
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          Account created — you can sign in below. If email verification is required, check your
          inbox.
        </output>
      ) : null}
      {reset ? (
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          Password updated. Sign in with your new password.
        </output>
      ) : null}
      {authRequired ? (
        <p className="rounded-sm border border-brand-300 bg-surface-container-low px-4 py-3 font-footer-links text-sm text-brand-500 dark:border-outline-variant dark:bg-surface-container dark:text-on-surface-variant">
          Please sign in to continue.
        </p>
      ) : null}
      <SellAuthIntentBanner />
      {verifyPending ? (
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          {verifyPending}
        </output>
      ) : null}
      {sessionExpired ? (
        <output
          className="block rounded-sm border border-error/30 bg-error-container/10 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          {sessionExpired}
        </output>
      ) : null}
      {twofaRequired ? (
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          {twofaRequired}
        </output>
      ) : null}
      <FormBanner message={bannerError ?? socialError} />
      {bannerError || socialError ? (
        <p className="-mt-6 font-footer-links text-xs text-on-surface-variant">
          Signed up with Google or Apple? Use the button above.
        </p>
      ) : null}
    </>
  );
}
