"use client";

import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { useActivateSetPasswordController } from "@/lib/auth/hooks/use-activate-set-password-controller";
import { Button } from "@auction/ui/components/button";

export function ActivateSetPasswordForm() {
  const { form, onSubmit, onSkip, loading, bannerError, userEmail, initializing } =
    useActivateSetPasswordController();

  if (initializing) {
    return (
      <output
        className="block animate-pulse text-center font-footer-links text-sm text-on-surface-variant"
        aria-live="polite"
      >
        Loading…
      </output>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {userEmail ? (
        <output
          className="block font-footer-links text-sm leading-relaxed text-on-surface"
          aria-live="polite"
        >
          Signed in as <span className="font-medium">{userEmail}</span>. Set a password so you can
          sign in faster next time, or skip for now.
        </output>
      ) : null}
      <FormBanner message={bannerError} />
      <div className="flex flex-col gap-8">
        <RHFPasswordField
          control={form.control}
          name="newPassword"
          label="Password"
          autoComplete="new-password"
        />
        <RHFPasswordField
          control={form.control}
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-4">
        <AuthSubmitButton loading={loading} loadingLabel="Saving…">
          Save password
        </AuthSubmitButton>
        <Button
          type="button"
          variant="ghost"
          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
          onClick={() => void onSkip()}
          disabled={loading}
        >
          Skip for now
        </Button>
      </div>
    </form>
  );
}
