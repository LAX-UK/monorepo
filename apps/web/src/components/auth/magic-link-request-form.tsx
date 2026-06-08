"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { useMagicLinkRequestController } from "@/lib/auth/hooks/use-magic-link-request-controller";
import { Button } from "@auction/ui/components/button";

type MagicLinkRequestFormProps = {
  /** Shown on the expired-link page when a link error query param is present. */
  linkError?: string | null;
};

export function MagicLinkRequestForm({ linkError }: MagicLinkRequestFormProps) {
  const {
    form,
    onSubmit,
    loading,
    bannerError,
    submittedEmail,
    resend,
    cooldown,
    turnstileSiteKey,
    onTurnstileToken,
    onTurnstileExpire,
    turnstileReady,
  } = useMagicLinkRequestController();

  const loginHref = buildAuthHref("/login");

  if (submittedEmail) {
    return (
      <div className="flex w-full flex-col gap-10">
        <FormBanner message={bannerError} />
        <output
          className="block font-footer-links text-sm leading-relaxed text-on-surface"
          aria-live="polite"
        >
          If we find an account for <span className="font-medium">{submittedEmail}</span>,
          we&apos;ll email a fresh sign-in link. Links expire in 15 minutes.
        </output>
        <TurnstileWidget
          siteKey={turnstileSiteKey}
          onToken={onTurnstileToken}
          onClear={onTurnstileExpire}
        />
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-11 rounded-md border border-outline-variant/40 bg-transparent px-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface hover:border-primary/50 hover:bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void resend()}
          disabled={cooldown > 0 || loading || !turnstileReady}
        >
          {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend activation link"}
        </Button>
        <AuthFooterLink prefix="Remembered your password?" linkText="Log in" href={loginHref} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {linkError ? (
        <output className="block font-footer-links text-sm leading-relaxed text-on-surface">
          {linkError}
        </output>
      ) : null}
      <FormBanner
        message={(form.formState.errors.root?.message as string | undefined) ?? bannerError ?? null}
      />
      <RHFInput
        control={form.control}
        name="email"
        label="Email Address"
        type="email"
        autoComplete="username"
      />
      <TurnstileWidget
        siteKey={turnstileSiteKey}
        onToken={onTurnstileToken}
        onClear={onTurnstileExpire}
      />
      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Sending…">
          Send activation link
        </AuthSubmitButton>
        <AuthFooterLink prefix="Remembered your password?" linkText="Log in" href={loginHref} />
      </div>
    </form>
  );
}
