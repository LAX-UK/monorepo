"use client";

import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { AUTH_FOOTER_LINK_ROW } from "@/lib/auth/auth-link-classes";
import type { SignInFormValues } from "@/lib/auth/schemas";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { useEffect } from "react";
import type { Control } from "react-hook-form";

type SignInCredentialsStepProps = {
  control: Control<SignInFormValues>;
  email: string;
  next: string;
  forgotPasswordHref: string;
  loading: boolean;
  signInSubmitDisabled: boolean;
  showCaptcha: boolean;
  turnstileSiteKey: string | null;
  onTurnstileToken: (token: string) => void;
  onTurnstileExpire: () => void;
  onChangeEmail: () => void;
  linkSent: boolean;
  linkCooldown: number;
  magicLinkLoading: boolean;
  magicLinkError: string | null;
  magicLinkTurnstileReady: boolean;
  onMagicLinkTurnstileToken: (token: string) => void;
  onMagicLinkTurnstileExpire: () => void;
  onRequestMagicLink: () => void;
  onResendMagicLink: () => void;
  sellIntent?: boolean;
  sellRegisterHref?: string;
};

export function SignInCredentialsStep({
  control,
  email,
  next,
  forgotPasswordHref,
  loading,
  signInSubmitDisabled,
  showCaptcha,
  turnstileSiteKey,
  onTurnstileToken,
  onTurnstileExpire,
  onChangeEmail,
  linkSent,
  linkCooldown,
  magicLinkLoading,
  magicLinkError,
  magicLinkTurnstileReady,
  onMagicLinkTurnstileToken,
  onMagicLinkTurnstileExpire,
  onRequestMagicLink,
  onResendMagicLink,
  sellIntent = false,
  sellRegisterHref,
}: SignInCredentialsStepProps) {
  useEffect(() => {
    const el = document.querySelector<HTMLInputElement>('input[autocomplete="current-password"]');
    el?.focus();
  }, []);

  if (linkSent) {
    return (
      <div className="flex w-full flex-col gap-8">
        {magicLinkError ? (
          <output className="block font-footer-links text-sm text-error" aria-live="polite">
            {magicLinkError}
          </output>
        ) : null}
        <output
          className="block font-footer-links text-sm leading-relaxed text-on-surface"
          aria-live="polite"
        >
          If we find an account for <span className="font-medium">{email}</span>, we&apos;ll email a
          secure sign-in link. Links expire in 15 minutes.
        </output>
        {turnstileSiteKey ? (
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={onMagicLinkTurnstileToken}
            onClear={onMagicLinkTurnstileExpire}
          />
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 rounded-md border border-outline-variant/40 bg-transparent px-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:border-link/50 hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void onResendMagicLink()}
          disabled={linkCooldown > 0 || magicLinkLoading || !magicLinkTurnstileReady}
        >
          {linkCooldown > 0 ? `Resend available in ${linkCooldown}s` : "Resend sign-in link"}
        </Button>
        <Button
          type="button"
          variant="link"
          size="link"
          className="font-footer-links text-sm"
          onClick={onChangeEmail}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <>
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
      <div className="flex flex-col gap-2">
        <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Email
        </span>
        <div className="flex items-center justify-between gap-4">
          <span className="font-footer-links text-sm text-on-surface">{email}</span>
          <Button
            type="button"
            variant="link"
            size="link"
            className="shrink-0 font-footer-links text-sm font-medium"
            onClick={onChangeEmail}
          >
            Change
          </Button>
        </div>
      </div>
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
      {turnstileSiteKey ? (
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onToken={onMagicLinkTurnstileToken}
          onClear={onMagicLinkTurnstileExpire}
        />
      ) : null}
      {magicLinkError ? (
        <output className="block font-footer-links text-sm text-error" aria-live="polite">
          {magicLinkError}
        </output>
      ) : null}
      <div className="flex flex-col gap-4">
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
            {sellRegisterHref ? (
              <Button
                asChild
                variant="cta"
                size="lg"
                className="min-h-[44px] flex-1 font-label uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
              >
                <Link href={sellRegisterHref}>Create an account</Link>
              </Button>
            ) : null}
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
          variant="outline"
          className="h-auto min-h-11 rounded-md border border-outline-variant/40 bg-transparent px-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:border-link/50 hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void onRequestMagicLink()}
          disabled={magicLinkLoading || !magicLinkTurnstileReady}
        >
          {magicLinkLoading ? "Sending…" : "Email me a sign-in link instead"}
        </Button>
      </div>
    </>
  );
}
