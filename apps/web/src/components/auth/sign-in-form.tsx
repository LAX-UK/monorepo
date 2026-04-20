"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { useSignInController } from "@/lib/auth/hooks/use-sign-in-controller";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const { form, onSubmit, loading, bannerError } = useSignInController(next);

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {searchParams.get("auth") === "required" ? (
        <p className="rounded-sm border border-brand-300 bg-surface-container-low px-4 py-3 font-footer-links text-sm text-brand-500 dark:border-outline-variant dark:bg-surface-container dark:text-on-surface-variant">
          Please sign in to continue.
        </p>
      ) : null}
      <FormBanner message={bannerError} />
      <div className="flex flex-col gap-10">
        <RHFInput
          control={form.control}
          name="email"
          label="Email Address"
          type="email"
          autoComplete="email"
        />
        <div className="flex flex-col gap-2">
          <RHFPasswordField
            control={form.control}
            name="password"
            label="Password"
            autoComplete="current-password"
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="min-h-[44px] content-center font-footer-links text-sm font-medium text-brand-900 underline decoration-brand-900 underline-offset-2 dark:text-primary"
            >
              Forgot password?
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Signing in…">
          Sign In
        </AuthSubmitButton>
        <AuthFooterLink prefix="Don't have an account?" linkText="Sign up" href="/register" />
      </div>
    </form>
  );
}
