"use client";

import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { passwordStrength } from "@/lib/auth/password-strength";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import { useId, useMemo } from "react";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";

export function SignUpFields({ control }: { control: Control<SignUpFormValues> }) {
  const pwdHintId = useId();
  const pwdMeterId = useId();
  const pwd = useWatch({ control, name: "password" }) ?? "";
  const strength = useMemo(() => passwordStrength(String(pwd)), [pwd]);

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
        label="Mobile number (optional)"
        type="tel"
        autoComplete="tel"
      />
      <div>
        <RHFPasswordField
          control={control}
          name="password"
          label="Password"
          autoComplete="new-password"
          ariaDescribedByExtra={`${pwdHintId} ${pwdMeterId}`}
        />
        <p id={pwdHintId} className="mt-2 font-footer-links text-xs text-on-surface-variant">
          At least 8 characters — mix letters, numbers, and symbols for a stronger password.
        </p>
        <div className="mt-3">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
            aria-hidden
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: pwd.length === 0 ? 0 : `${strength.width}%` }}
            />
          </div>
          <output
            id={pwdMeterId}
            className="mt-1 block font-footer-links text-xs text-on-surface-variant"
            aria-live="polite"
          >
            {pwd.length > 0 ? (
              <>
                Password strength:{" "}
                <span className="font-medium text-on-surface">{strength.label}</span>
              </>
            ) : null}
          </output>
        </div>
      </div>
    </div>
  );
}
