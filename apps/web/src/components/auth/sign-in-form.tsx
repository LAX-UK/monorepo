"use client";

import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { type SignInFormValues, signInFormSchema } from "@/lib/auth/schemas";
import { signInService } from "@/lib/auth/services/sign-in.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const { run, loading, bannerError } = useAuthSubmit(signInService);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await run(data);
    if (result.ok) {
      router.push(next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      {searchParams.get("auth") === "required" ? (
        <p className="rounded-sm border border-brand-300 bg-page-bg px-4 py-3 font-footer-links text-sm text-brand-500">
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
              className="font-footer-links text-sm font-medium text-brand-900 underline decoration-brand-900 underline-offset-2"
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
