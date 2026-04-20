"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { SignUpFields } from "@/components/auth/sign-up-fields";
import { SignUpLegalConsent } from "@/components/auth/sign-up-legal-consent";
import { useSignUpController } from "@/lib/auth/hooks/use-sign-up-controller";

export function SignUpForm() {
  const { form, onSubmit, loading, bannerError } = useSignUpController();

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      <FormBanner message={bannerError} />
      <SignUpFields control={form.control} />
      <SignUpLegalConsent control={form.control} />

      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Signing up…">
          Sign Up
        </AuthSubmitButton>
        <AuthFooterLink prefix="Already have an account?" linkText="Log in" href="/login" />
      </div>
    </form>
  );
}
