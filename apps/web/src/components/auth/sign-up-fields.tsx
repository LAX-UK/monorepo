"use client";

import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import type { Control } from "react-hook-form";

export function SignUpFields({ control }: { control: Control<SignUpFormValues> }) {
  return (
    <div className="flex flex-col gap-10">
      <RHFInput control={control} name="firstName" label="First Name" autoComplete="given-name" />
      <RHFInput control={control} name="lastName" label="Last Name" autoComplete="family-name" />
      <RHFInput
        control={control}
        name="email"
        label="Email Address"
        type="email"
        autoComplete="email"
      />
      <RHFInput
        control={control}
        name="mobile"
        label="Mobile Number"
        type="tel"
        autoComplete="tel"
      />
      <RHFPasswordField
        control={control}
        name="password"
        label="Password"
        autoComplete="new-password"
      />
    </div>
  );
}
