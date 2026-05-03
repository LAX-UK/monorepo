"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SignUpFields } from "@/components/auth/sign-up-fields";
import { SignUpLegalConsent } from "@/components/auth/sign-up-legal-consent";
import { SocialSignInButtons } from "@/components/auth/social-sign-in-buttons";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { useSignUpController } from "@/lib/auth/hooks/use-sign-up-controller";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

type Props = {
  inviteToken?: string;
};

export function SignUpForm({ inviteToken }: Props) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const { form, onSubmit, loading, bannerError } = useSignUpController(
    inviteToken ? { inviteToken } : undefined,
  );

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
      <FormBanner message={bannerError} />
      {inviteToken ? (
        <p className="font-body text-sm text-on-surface-variant">
          You’re signing up with an invitation
          {form.watch("email") ? ` for ${form.watch("email")}` : ""}.
        </p>
      ) : null}
      <SignUpFields control={form.control} />
      <SignUpLegalConsent control={form.control} />
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 text-on-surface-variant" aria-hidden>
          <span className="h-px flex-1 bg-outline-variant/40" />
          <span className="font-footer-links text-xs uppercase tracking-[0.25em]">or</span>
          <span className="h-px flex-1 bg-outline-variant/40" />
        </div>
        <SocialSignInButtons next={next} />
      </div>

      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Signing up…">
          Sign Up
        </AuthSubmitButton>
        <AuthFooterLink prefix="Already have an account?" linkText="Log in" href="/login" />
      </div>
    </form>
  );
}
