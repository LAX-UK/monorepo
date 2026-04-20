"use client";

import { RHFCheckboxField } from "@/components/auth/primitives/checkbox-field";
import { AuthFooterLink } from "@/components/auth/primitives/footer-link";
import { FormBanner } from "@/components/auth/primitives/form-error";
import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { AuthSubmitButton } from "@/components/auth/primitives/submit-button";
import { type SignUpFormValues, signUpFormSchema } from "@/lib/auth/schemas";
import { signUpService } from "@/lib/auth/services/sign-up.service";
import { useAuthSubmit } from "@/lib/auth/use-auth-submit";
import { SITE_SHORT_NAME } from "@/lib/brand";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

export function SignUpForm() {
  const router = useRouter();
  const { run, loading, bannerError } = useAuthSubmit(signUpService);

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      password: "",
      acceptTerms: false,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const result = await run(data);
    if (result.ok) {
      router.push("/login?next=/dashboard");
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-10" noValidate>
      <FormBanner message={bannerError} />
      <div className="flex flex-col gap-10">
        <RHFInput
          control={form.control}
          name="firstName"
          label="First Name"
          autoComplete="given-name"
        />
        <RHFInput
          control={form.control}
          name="lastName"
          label="Last Name"
          autoComplete="family-name"
        />
        <RHFInput
          control={form.control}
          name="email"
          label="Email Address"
          type="email"
          autoComplete="email"
        />
        <RHFInput
          control={form.control}
          name="mobile"
          label="Mobile Number"
          type="tel"
          autoComplete="tel"
        />
        <RHFPasswordField
          control={form.control}
          name="password"
          label="Password"
          autoComplete="new-password"
        />
      </div>

      <RHFCheckboxField control={form.control} name="acceptTerms">
        I agree to {SITE_SHORT_NAME}{" "}
        <Link href="/legal" className="font-medium text-brand-900 underline underline-offset-2">
          Terms of Use
        </Link>
        . I confirm that I have read and understood the{" "}
        <Link href="/legal" className="font-medium text-brand-900 underline underline-offset-2">
          Privacy Notice
        </Link>{" "}
        and I am 18 or over.
      </RHFCheckboxField>

      <div className="flex flex-col gap-6">
        <AuthSubmitButton loading={loading} loadingLabel="Signing up…">
          Sign Up
        </AuthSubmitButton>
        <AuthFooterLink prefix="Already have an account?" linkText="Log in" href="/login" />
      </div>
    </form>
  );
}
