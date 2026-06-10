"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SellAuthIntentBanner } from "@/components/auth/sell-auth-intent-banner";
import { SignUpFields } from "@/components/auth/sign-up-fields";
import { SignUpLegalConsent } from "@/components/auth/sign-up-legal-consent";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { useSignUpController } from "@/lib/auth/hooks/use-sign-up-controller";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { rememberPendingEntityInviteAction } from "@/lib/legal-entity/pending-invite-cookie.actions";
import { MailCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type SignUpInvitePreview = {
  email: string;
  roleLabel: string;
  entityScoped: boolean;
};

type Props = {
  inviteToken?: string;
  /** Server-resolved invite details; locks the email and hides persona choice. */
  invitePreview?: SignUpInvitePreview;
  orgModuleEnabled?: boolean;
  phoneDefaultCountry?: string;
};

export function SignUpForm({
  inviteToken,
  invitePreview,
  orgModuleEnabled = true,
  phoneDefaultCountry = "GB",
}: Props) {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const safeNext = rawNext && isSafeNextPath(rawNext) ? rawNext : undefined;
  const next = safeNext ?? "/dashboard";
  const sellIntent = searchParams.get("intent") === "sell";
  const loginHref = buildAuthHref("/login", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
  });
  const controllerOpts = {
    ...(inviteToken ? { inviteToken } : {}),
    ...(invitePreview?.email ? { defaultEmail: invitePreview.email } : {}),
    ...(safeNext ? { next: safeNext } : {}),
    phoneDefaultCountry,
    ...(sellIntent ? { sellIntent: true } : {}),
  };
  const {
    form,
    onSubmit,
    loading,
    bannerError,
    turnstileSiteKey,
    turnstileReady,
    onTurnstileToken,
    onTurnstileExpire,
  } = useSignUpController(controllerOpts);

  // Entity (organisation) invites are accepted post-verification via cookie;
  // platform invites are consumed during registration and need no cookie.
  useEffect(() => {
    if (!inviteToken || !orgModuleEnabled) return;
    if (invitePreview && !invitePreview.entityScoped) return;
    void rememberPendingEntityInviteAction(inviteToken);
  }, [inviteToken, orgModuleEnabled, invitePreview]);

  const isInvite = Boolean(inviteToken);
  const showPersonaChoice = orgModuleEnabled && !isInvite;

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      <SellAuthIntentBanner />
      <FormBanner
        message={(form.formState.errors.root?.message as string | undefined) ?? bannerError ?? null}
      />
      {invitePreview ? (
        <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary-container/15 p-4">
          <MailCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="font-body text-sm font-medium text-on-surface">
              You&apos;ve been invited to join London Art Exchange
            </p>
            <p className="font-body text-sm text-on-surface-variant">
              Joining as{" "}
              <span className="font-medium text-on-surface">{invitePreview.roleLabel}</span>. Finish
              creating your account below.
            </p>
          </div>
        </div>
      ) : isInvite ? (
        <p className="font-body text-sm text-on-surface-variant">
          You&apos;re signing up with an invitation. Use the email address the invitation was sent
          to.
        </p>
      ) : null}
      <SignUpFields
        control={form.control}
        orgModuleEnabled={showPersonaChoice}
        phoneDefaultCountry={phoneDefaultCountry}
        {...(invitePreview?.email ? { lockedEmail: invitePreview.email } : {})}
      />
      <SignUpLegalConsent control={form.control} />
      <TurnstileWidget
        siteKey={turnstileSiteKey}
        onToken={onTurnstileToken}
        onClear={onTurnstileExpire}
      />
      {!isInvite ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4 text-on-surface-variant" aria-hidden>
            <span className="h-px flex-1 bg-outline-variant/40" />
            <span className="font-footer-links text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]">
              or
            </span>
            <span className="h-px flex-1 bg-outline-variant/40" />
          </div>
          <SocialSignInButtons next={next} />
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Signing up…" disabled={!turnstileReady}>
          {isInvite ? "Accept invitation & sign up" : "Sign Up"}
        </AuthSubmitButton>
        <AuthFooterLink prefix="Already have an account?" linkText="Log in" href={loginHref} />
      </div>
    </form>
  );
}
