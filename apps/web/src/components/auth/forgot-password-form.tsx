"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { type ForgotPasswordFormValues, forgotPasswordFormSchema } from "@/lib/auth/schemas";
import { forgotPasswordService } from "@/lib/auth/services/forgot-password.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

export function ForgotPasswordForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const { run, loading, bannerError } = useAuthSubmit(forgotPasswordService);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await run(data);
    if (result.ok) {
      setSubmittedEmail(data.email);
    }
  });

  if (submittedEmail) {
    return (
      <div className="flex w-full flex-col gap-10">
        <p className="font-footer-links text-sm leading-relaxed text-[#161616]">
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
