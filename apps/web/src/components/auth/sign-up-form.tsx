"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SignUpFields } from "@/components/auth/sign-up-fields";
import { SignUpLegalConsent } from "@/components/auth/sign-up-legal-consent";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { useSignUpController } from "@/lib/auth/hooks/use-sign-up-controller";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { rememberPendingEntityInviteAction } from "@/lib/legal-entity/pending-invite-cookie.actions";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

type Props = {
  inviteToken?: string;
};

export function SignUpForm({ inviteToken }: Props) {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const safeNext = rawNext && isSafeNextPath(rawNext) ? rawNext : undefined;
  const next = safeNext ?? "/dashboard";
  const loginHref = buildAuthHref("/login", {
    ...(safeNext !== undefined ? { next: safeNext } : {}),
  });
  const controllerOpts =
    inviteToken || safeNext
      ? { ...(inviteToken ? { inviteToken } : {}), ...(safeNext ? { next: safeNext } : {}) }
      : undefined;
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
    if (!inviteToken) return;
    void rememberPendingEntityInviteAction(inviteToken);
  }, [inviteToken]);

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
      <FormBanner
        message={(form.formState.errors.root?.message as string | undefined) ?? bannerError ?? null}
      />
      {inviteToken ? (
        <p className="font-body text-sm text-on-surface-variant">
          You’re signing up with an invitation
          {form.watch("email") ? ` for ${form.watch("email")}` : ""}.
        </p>
      ) : null}
      <SignUpFields control={form.control} />
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
    </form>
  );
}
