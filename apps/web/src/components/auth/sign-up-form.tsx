"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SellAuthIntentBanner } from "@/components/auth/sell-auth-intent-banner";
import { SignUpFields } from "@/components/auth/sign-up-fields";
import { SignUpLegalConsent } from "@/components/auth/sign-up-legal-consent";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { useSignUpController } from "@/lib/auth/hooks/use-sign-up-controller";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { rememberPendingEntityInviteAction } from "@/lib/legal-entity/pending-invite-cookie.actions";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

type Props = {
  inviteToken?: string;
  orgModuleEnabled?: boolean;
  phoneDefaultCountry?: string;
};

export function SignUpForm({
  inviteToken,
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
    onTurnstileToken,
    onTurnstileExpire,
  } = useSignUpController(controllerOpts);

  useEffect(() => {
    if (!inviteToken || !orgModuleEnabled) return;
    void rememberPendingEntityInviteAction(inviteToken);
  }, [inviteToken, orgModuleEnabled]);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl()}/invitations/preview?token=${encodeURIComponent(inviteToken)}`,
        );
        const body = (await res.json().catch(() => ({}))) as {
          data?: { email?: string; targetRole?: string };
        };
        if (!res.ok || !body.data?.email || cancelled) return;
        form.setValue("email", body.data.email);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, form]);

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      <SellAuthIntentBanner />
      <FormBanner
        message={(form.formState.errors.root?.message as string | undefined) ?? bannerError ?? null}
      />
      {inviteToken && !orgModuleEnabled ? (
        <p className="font-body text-sm text-on-surface-variant">
          Organisation invitations are not available yet on this site. Please try again after
          launch, or contact{" "}
          <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className="font-medium text-primary underline">
            {SITE_SUPPORT_EMAIL}
          </a>
          .
        </p>
      ) : null}
      {inviteToken && orgModuleEnabled ? (
        <p className="font-body text-sm text-on-surface-variant">
          You’re signing up with an invitation
          {form.watch("email") ? ` for ${form.watch("email")}` : ""}.
        </p>
      ) : null}
      {(!inviteToken || orgModuleEnabled) && (
        <>
          <SignUpFields
            control={form.control}
            orgModuleEnabled={orgModuleEnabled}
            phoneDefaultCountry={phoneDefaultCountry}
          />
          <SignUpLegalConsent control={form.control} />
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onToken={onTurnstileToken}
            onClear={onTurnstileExpire}
          />
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

          <div className="flex flex-col gap-6">
            <AuthSubmitButton loading={loading} loadingLabel="Signing up…">
              Sign Up
            </AuthSubmitButton>
            <AuthFooterLink prefix="Already have an account?" linkText="Log in" href={loginHref} />
          </div>
        </>
      )}
    </form>
  );
}
