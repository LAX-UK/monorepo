"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { buildAuthHref } from "@/lib/auth/auth-route-links";
import { useForgotPasswordController } from "@/lib/auth/hooks/use-forgot-password-controller";
import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { Button } from "@auction/ui/components/button";
import { useSearchParams } from "next/navigation";

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const loginHref = buildAuthHref("/login", {
    ...(isSafeNextPath(rawNext) ? { next: rawNext } : {}),
  });
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
  } = useForgotPasswordController();

  if (submittedEmail) {
    return (
      <div className="flex w-full flex-col gap-10">
        <FormBanner message={bannerError} />
        <output
          className="block font-footer-links text-sm leading-relaxed text-on-surface"
          aria-live="polite"
        >
          If we find an account for <span className="font-medium">{submittedEmail}</span>,
          we&apos;ll email next steps. Accounts created with Google or Apple receive sign-in
          instructions instead of a reset link.
        </output>
        <p className="font-body text-xs leading-relaxed text-on-surface-variant">
          Check spam and promotions folders. If you still don&apos;t see anything, wait for the
          resend timer and try again, or sign in with Google or Apple if you used those to create
          your account.
        </p>
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
          {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend email"}
        </Button>
        <AuthFooterLink prefix="Remembered it?" linkText="Log in" href={loginHref} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
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
          Send reset link
        </AuthSubmitButton>
        <AuthFooterLink prefix="Remembered it?" linkText="Log in" href={loginHref} />
      </div>
    </form>
  );
}
