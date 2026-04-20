"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { useForgotPasswordController } from "@/lib/auth/hooks/use-forgot-password-controller";

export function ForgotPasswordForm() {
  const { form, onSubmit, loading, bannerError, submittedEmail } = useForgotPasswordController();

  if (submittedEmail) {
    return (
      <div className="flex w-full flex-col gap-10">
        <p className="font-footer-links text-sm leading-relaxed text-on-surface">
          If an account exists for <span className="font-medium">{submittedEmail}</span>, we&apos;ve
          sent reset instructions.
        </p>
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
