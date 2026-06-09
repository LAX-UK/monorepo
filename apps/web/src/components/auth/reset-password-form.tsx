"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { LogoutButton } from "@/components/layout/logout-button";
import { useResetPasswordController } from "@/lib/auth/hooks/use-reset-password-controller";
import { useAppSession } from "@/lib/auth/use-app-session";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const { form, onSubmit, loading, bannerError, lastErrorCode } = useResetPasswordController(token);
  const { user } = useAppSession();
  const signedInEmail = user?.email ?? "";
  const tokenInvalid = lastErrorCode === "reset_token_invalid";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {signedInEmail ? (
        <output
          className="block rounded-sm border border-brand-300 bg-surface-container-low px-4 py-3 font-footer-links text-sm text-on-surface dark:border-outline-variant dark:bg-surface-container dark:text-on-surface-variant"
          aria-live="polite"
        >
          You&apos;re signed in as <span className="font-medium">{signedInEmail}</span>. If this
          reset is for a different account, sign out before saving your new password.
          <span className="mt-3 block">
            <LogoutButton className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-brand-900 underline dark:text-primary" />
          </span>
        </output>
      ) : null}
      <FormBanner message={bannerError} />
      {tokenInvalid ? (
        <Button
          asChild
          variant="cta"
          size="lg"
          className="font-label uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
        >
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      ) : null}
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
