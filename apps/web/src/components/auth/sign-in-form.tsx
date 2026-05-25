"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { LogoutButton } from "@/components/layout/logout-button";
import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { useSignInController } from "@/lib/auth/hooks/use-sign-in-controller";
import { isSafeNextPath, resolvePostAuthDestination } from "@/lib/auth/post-auth-destination";
import { socialErrorMessage } from "@/lib/auth/social-error-message";
import { useAppSession } from "@/lib/auth/use-app-session";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

type SignInFormProps = {
  /** When true (e.g. `/login?switch=1`), show sign-out to use another account. */
  switchAccount?: boolean;
};

export function SignInForm({ switchAccount = false }: SignInFormProps) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const {
    form,
    onSubmit,
    loading,
    bannerError,
    showCaptcha,
    turnstileSiteKey,
    onTurnstileToken,
    onTurnstileExpire,
  } = useSignInController(next);
  const socialError =
    searchParams.get("social_error") === "1"
      ? socialErrorMessage(searchParams.get("reason"))
      : null;
  const verifyPending =
    searchParams.get("verify_pending") === "1"
      ? "Please check your inbox to finish verifying your email."
      : null;
  const sessionExpired =
    searchParams.get("session_expired") === "1"
      ? "Your session expired or could not be restored. Please sign in again."
      : null;

  // Strip transient banner params from the URL after render so refresh / back-nav
  // doesn't re-show "session expired" once the user has acknowledged it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    let mutated = false;
    for (const key of ["session_expired", "auth", "social_error", "reason", "verify_pending"]) {
      if (params.has(key)) {
        params.delete(key);
        mutated = true;
      }
    }
    if (!mutated) return;
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, []);

  const { user, pending } = useAppSession();
  const emailValue = form.watch("email");
  const safeNext = isSafeNextPath(next) ? next : undefined;
  const registerHref = buildAuthHref("/register", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
  });
  const forgotPasswordHref = buildAuthHref("/forgot-password", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
    ...(emailValue ? { email: emailValue } : {}),
  });
  if (switchAccount) {
    if (pending) {
      return (
        <div className="h-64 animate-pulse rounded-md bg-surface-container-high" aria-hidden />
      );
    }
  }

  if (switchAccount && user?.email) {
    return (
      <div className="flex w-full flex-col gap-8">
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          You&apos;re signed in as <span className="font-medium text-on-surface">{user.email}</span>
          . Sign out to use a different account, or continue to your dashboard.
        </output>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            asChild
            variant="cta"
            size="lg"
            className="font-label uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
          >
            <Link
              href={resolvePostAuthDestination({
                user: {
                  email: user.email,
                  role: user.role,
                  staffRole: user.staffRole ?? null,
                  emailVerified: user.emailVerified ?? false,
                  suspended: user.suspended ?? false,
                },
                requestedNext: next,
                context: "redirect-if-authed",
                requireEmailVerification: false,
                withWelcomeBack: true,
              })}
            >
              Continue to dashboard
            </Link>
          </Button>
          <LogoutButton className="min-h-11 rounded-md border border-outline-variant/30 px-4 py-2 text-center font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-high" />
        </div>
      </div>
    );
  }

  if (!switchAccount && user?.email && !pending) {
    const dest = resolvePostAuthDestination({
      user: {
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified ?? false,
        suspended: user.suspended ?? false,
      },
      requestedNext: next,
      context: "redirect-if-authed",
      requireEmailVerification: false,
      withWelcomeBack: true,
    });
    return (
      <div className="flex w-full flex-col gap-8">
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          You&apos;re already signed in as{" "}
          <span className="font-medium text-on-surface">{user.email}</span>.
        </output>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <Button
            asChild
            variant="cta"
            size="lg"
            className="font-label uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
          >
            <Link href={dest}>Continue</Link>
          </Button>
          <LogoutButton className="min-h-11 rounded-md border border-outline-variant/30 px-4 py-2 text-center font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:bg-surface-container-high" />
        </div>
        {isSafeNextPath(next) ? (
          <p className="text-center font-footer-links text-xs text-on-surface-variant">
            <Link href={`/login?switch=1&next=${encodeURIComponent(next)}`} className="underline">
              Use a different account
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {searchParams.get("registered") === "1" ? (
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          Account created — you can sign in below. If email verification is required, check your
          inbox.
        </output>
      ) : null}
      {searchParams.get("reset") === "1" ? (
        <output
          className="block rounded-sm border border-primary/30 bg-primary-container/15 px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container"
          aria-live="polite"
        >
          Password updated. Sign in with your new password.
        </output>
      ) : null}
      {searchParams.get("auth") === "required" ? (
        <p className="rounded-sm border border-brand-300 bg-surface-container-low px-4 py-3 font-footer-links text-sm text-brand-500 dark:border-outline-variant dark:bg-surface-container dark:text-on-surface-variant">
          Please sign in to continue.
        </p>
      ) : null}
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
      <FormBanner message={bannerError ?? socialError} />
      {bannerError || socialError ? (
        <p className="-mt-6 font-footer-links text-xs text-on-surface-variant">
          Signed up with Google or Apple? Use the button above.
        </p>
      ) : null}
      <div className="flex flex-col gap-6">
        <SocialSignInButtons next={next} />
        <div className="flex items-center gap-4 text-on-surface-variant" aria-hidden>
          <span className="h-px flex-1 bg-outline-variant/40" />
          <span className="font-footer-links text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
            or
          </span>
          <span className="h-px flex-1 bg-outline-variant/40" />
        </div>
      </div>
      <div className="flex flex-col gap-10">
        <RHFInput
          control={form.control}
          name="email"
          label="Email Address"
          type="email"
          autoComplete="username"
        />
        <div className="flex flex-col gap-2">
          <RHFPasswordField
            control={form.control}
            name="password"
            label="Password"
            autoComplete="current-password"
          />
          {showCaptcha && turnstileSiteKey ? (
            <div className="flex flex-col gap-2">
              <p className="font-footer-links text-sm text-on-surface-variant">
                For your security, complete the check below and try again.
              </p>
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onToken={onTurnstileToken}
                onClear={onTurnstileExpire}
              />
            </div>
          ) : null}
          <div className="flex justify-end">
            <Link
              href={forgotPasswordHref}
              className="min-h-[44px] content-center font-footer-links text-sm font-medium text-brand-900 underline decoration-brand-900 underline-offset-2 dark:text-primary"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Signing in…">
          Sign In
        </AuthSubmitButton>
        <AuthFooterLink prefix="Don't have an account?" linkText="Sign up" href={registerHref} />
      </div>
    </form>
  );
}
