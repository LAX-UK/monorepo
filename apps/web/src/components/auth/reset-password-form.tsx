"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { useResetPasswordController } from "@/lib/auth/hooks/use-reset-password-controller";

export function ResetPasswordForm({ token }: { token: string }) {
  const { form, onSubmit, loading, bannerError } = useResetPasswordController(token);

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      <FormBanner message={bannerError} />
      <div className="flex flex-col gap-8">
        <RHFPasswordField
          control={form.control}
          name="newPassword"
          label="New Password"
          autoComplete="new-password"
        />
        <RHFPasswordField
          control={form.control}
          name="confirmPassword"
          label="Confirm New Password"
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Saving…">
          Update password
        </AuthSubmitButton>
        <AuthFooterLink
          prefix="Need a fresh link?"
          linkText="Request reset"
          href="/forgot-password"
        />
      </div>
    </form>
  );
}
