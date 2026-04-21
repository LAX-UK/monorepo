"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { useForgotPasswordController } from "@/lib/auth/hooks/use-forgot-password-controller";

export function ForgotPasswordForm() {
  const { form, onSubmit, loading, bannerError, submittedEmail, resend, cooldown } =
    useForgotPasswordController();

  if (submittedEmail) {
    return (
      <div className="flex w-full flex-col gap-10">
        <output
          className="block font-footer-links text-sm leading-relaxed text-on-surface"
          aria-live="polite"
        >
          If an account exists for <span className="font-medium">{submittedEmail}</span>, we&apos;ve
          sent reset instructions.
        </output>
        <button
          type="button"
          className="min-h-11 rounded-md border border-outline-variant/40 px-4 font-label text-xs font-bold uppercase tracking-widest text-on-surface transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => void resend()}
          disabled={cooldown > 0 || loading}
        >
          {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend email"}
        </button>
        <AuthFooterLink prefix="Remembered it?" linkText="Log in" href="/login" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      <FormBanner message={bannerError} />
      <RHFInput
        control={form.control}
        name="email"
        label="Email Address"
        type="email"
        autoComplete="email"
      />
      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Sending…">
          Send reset link
        </AuthSubmitButton>
        <AuthFooterLink prefix="Remembered it?" linkText="Log in" href="/login" />
      </div>
    </form>
  );
}
