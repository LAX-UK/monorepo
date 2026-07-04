"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { AUTH_FOOTER_LINK_ROW } from "@/lib/auth/auth-link-classes";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { FormEventHandler } from "react";
import type { Control } from "react-hook-form";

type SignInLegacyPasswordFormProps = {
  control: Control<{ email: string; password: string }>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  loading: boolean;
  signInSubmitDisabled: boolean;
  showCaptcha: boolean;
  turnstileSiteKey: string | null;
  onTurnstileToken: (token: string) => void;
  onTurnstileExpire: () => void;
  forgotPasswordHref: string;
  sellIntent: boolean;
  sellRegisterHref: string;
  registerHref: string;
  next: string;
  banners: React.ReactNode;
  onUsePhone: () => void;
};

export function SignInLegacyPasswordForm({
  control,
  onSubmit,
  loading,
  signInSubmitDisabled,
  showCaptcha,
  turnstileSiteKey,
  onTurnstileToken,
  onTurnstileExpire,
  forgotPasswordHref,
  sellIntent,
  sellRegisterHref,
  registerHref,
  next,
  banners,
  onUsePhone,
}: SignInLegacyPasswordFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {banners}
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
          control={control}
          name="email"
          label="Email Address"
          type="email"
          autoComplete="username"
        />
        <div className="flex flex-col gap-2">
          <RHFPasswordField
            control={control}
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
            <Link href={forgotPasswordHref} className={AUTH_FOOTER_LINK_ROW}>
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {sellIntent ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <AuthSubmitButton
              loading={loading}
              loadingLabel="Signing in…"
              className="flex-1"
              disabled={signInSubmitDisabled}
            >
              Sign In
            </AuthSubmitButton>
            <Button
              asChild
              variant="cta"
              size="lg"
              className="min-h-[44px] flex-1 font-label uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
            >
              <Link href={sellRegisterHref}>Create an account</Link>
            </Button>
          </div>
        ) : (
          <AuthSubmitButton
            loading={loading}
            loadingLabel="Signing in…"
            disabled={signInSubmitDisabled}
          >
            Sign In
          </AuthSubmitButton>
        )}
        <Button
          type="button"
          variant="link"
          size="link"
          className="font-footer-links text-sm"
          onClick={onUsePhone}
        >
          Sign in with phone number
        </Button>
        {sellIntent ? (
          <p className="text-center font-footer-links text-sm text-on-surface-variant">
            New to LAX? Create an account to start your submission in about 3 minutes.
          </p>
        ) : (
          <AuthFooterLink prefix="Don't have an account?" linkText="Sign up" href={registerHref} />
        )}
      </div>
    </form>
  );
}
