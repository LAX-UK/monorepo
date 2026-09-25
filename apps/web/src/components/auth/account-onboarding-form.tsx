"use client";

import { RHFCheckboxField } from "@/components/auth/primitives/checkbox-field";
import { PhoneNumberField } from "@/components/forms/phone-number-field";
import { AUTH_INLINE_LINK } from "@/lib/auth/auth-link-classes";
import { submitAccountOnboarding } from "@/lib/auth/services/account-onboarding.client";
import { SIGN_UP_PERSONA_OPTIONS } from "@/lib/auth/sign-up-persona-options";
import { SITE_SHORT_NAME } from "@/lib/brand";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { RadioCardGroup } from "@auction/ui/components/radio-card-group";
import { accountOnboardingClientFormSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CountryCode } from "libphonenumber-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";

type FormValues = z.input<typeof accountOnboardingClientFormSchema>;

export function AccountOnboardingForm({
  defaultFirstName,
  defaultLastName,
  inviteToken,
  nextPath,
  phoneDefaultCountry = "GB",
}: {
  defaultFirstName: string;
  defaultLastName: string;
  inviteToken?: string | null;
  nextPath: string;
  phoneDefaultCountry?: CountryCode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(accountOnboardingClientFormSchema),
    defaultValues: {
      firstName: defaultFirstName,
      lastName: defaultLastName,
      persona: "individual",
      acceptTerms: false,
      phone: { country: phoneDefaultCountry, number: "" },
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setBusy(true);
    setError(null);
    const parsed = accountOnboardingClientFormSchema.safeParse(values);
    if (!parsed.success) {
      setBusy(false);
      setError("Please check the form and try again.");
      return;
    }
    const phone = parsed.data.phone;
    const result = await submitAccountOnboarding({
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      persona: parsed.data.persona,
      acceptTerms: true,
      ...(inviteToken ? { inviteToken } : {}),
      ...(phone?.number.trim()
        ? { phone: { country: phone.country, number: phone.number.trim() } }
        : {}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(nextPath);
  });

  return (
    <form className="flex w-full flex-col gap-6" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" autoComplete="given-name" {...form.register("firstName")} />
          {form.formState.errors.firstName?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.firstName.message}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" autoComplete="family-name" {...form.register("lastName")} />
          {form.formState.errors.lastName?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {form.formState.errors.lastName.message}
            </p>
          ) : null}
        </div>
      </div>
      <Controller
        control={form.control}
        name="persona"
        render={({ field, fieldState }) => (
          <RadioCardGroup
            legend="I'm joining as…"
            value={field.value}
            onValueChange={field.onChange}
            options={SIGN_UP_PERSONA_OPTIONS}
            inputRef={field.ref}
            {...(fieldState.error?.message ? { error: fieldState.error.message } : {})}
          />
        )}
      />
      <Controller
        control={form.control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneNumberField
            id="onboarding-phone"
            defaultCountry={phoneDefaultCountry}
            value={field.value ?? { country: phoneDefaultCountry, number: "" }}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? null}
          />
        )}
      />
      <RHFCheckboxField control={form.control} name="acceptTerms">
        I agree to {SITE_SHORT_NAME}{" "}
        <Link href="/terms" className={AUTH_INLINE_LINK}>
          Conditions of Business
        </Link>
        . I confirm that I have read and understood the{" "}
        <Link href="/privacy" className={AUTH_INLINE_LINK}>
          Privacy Notice
        </Link>{" "}
        and I am 18 or over.
      </RHFCheckboxField>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}
