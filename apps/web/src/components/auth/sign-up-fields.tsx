"use client";

import { RHFPasswordField } from "@/components/auth/primitives/password-field";
import { RHFInput } from "@/components/auth/primitives/rhf-input";
import { PhoneNumberField } from "@/components/forms/phone-number-field";
import { passwordStrength } from "@/lib/auth/password-strength";
import { isPersonalDomain } from "@/lib/auth/personal-email-domains";
import type { SignUpFormValues } from "@/lib/auth/schemas";
import { Label } from "@auction/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@auction/ui/components/radio-group";
import { useId, useMemo } from "react";
import { type Control, Controller, useWatch } from "react-hook-form";

export function SignUpFields({
  control,
  orgModuleEnabled = true,
  phoneDefaultCountry = "GB",
  lockedEmail,
}: {
  control: Control<SignUpFormValues>;
  orgModuleEnabled?: boolean;
  phoneDefaultCountry?: string;
  /** Invitation signups: email is fixed to the invited address. */
  lockedEmail?: string;
}) {
  const pwdHintId = useId();
  const pwdMeterId = useId();
  const personaGroupId = useId();
  const personaIndividualId = useId();
  const personaOrganisationId = useId();
  const personaNudgeId = useId();
  const pwd = useWatch({ control, name: "password" }) ?? "";
  const persona = useWatch({ control, name: "persona" });
  const email = useWatch({ control, name: "email" }) ?? "";
  const strength = useMemo(() => passwordStrength(String(pwd)), [pwd]);
  const showWorkEmailNudge = persona === "organisation" && isPersonalDomain(email);

  return (
    <div className="flex flex-col gap-10">
      {orgModuleEnabled ? (
        <Controller
          control={control}
          name="persona"
          render={({ field, fieldState }) => (
            <fieldset
              aria-labelledby={personaGroupId}
              aria-describedby={fieldState.error?.message ? `${personaGroupId}-error` : undefined}
            >
              <legend
                id={personaGroupId}
                className="mb-3 font-label text-sm font-medium text-on-surface"
              >
                I'm joining as…
              </legend>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="flex flex-col gap-3"
              >
                <Label
                  htmlFor={personaIndividualId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/40 p-3 has-[:checked]:border-primary"
                >
                  <RadioGroupItem
                    id={personaIndividualId}
                    value="individual"
                    className="mt-0.5"
                    ref={field.ref}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-body text-sm font-medium text-on-surface">
                      An individual
                    </span>
                    <span className="font-body text-xs text-on-surface-variant">
                      Bid and buy on your own behalf.
                    </span>
                  </span>
                </Label>
                <Label
                  htmlFor={personaOrganisationId}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/40 p-3 has-[:checked]:border-primary"
                >
                  <RadioGroupItem
                    id={personaOrganisationId}
                    value="organisation"
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-body text-sm font-medium text-on-surface">
                      Representing a gallery, dealer, or estate
                    </span>
                    <span className="font-body text-xs text-on-surface-variant">
                      Sell and consign on behalf of an organisation.
                    </span>
                  </span>
                </Label>
              </RadioGroup>
              {fieldState.error?.message ? (
                <p
                  id={`${personaGroupId}-error`}
                  className="mt-2 font-footer-links text-xs text-error"
                >
                  {fieldState.error.message}
                </p>
              ) : null}
            </fieldset>
          )}
        />
      ) : null}
      <RHFInput control={control} name="firstName" label="First Name" autoComplete="given-name" />
      <RHFInput control={control} name="lastName" label="Last Name" autoComplete="family-name" />
      {lockedEmail ? (
        <div className="flex flex-col gap-1.5">
          <span className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Email Address
          </span>
          <p className="rounded-md border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body text-sm text-on-surface">
            {lockedEmail}
          </p>
          <p className="font-footer-links text-xs text-on-surface-variant">
            Your invitation is tied to this email address.
          </p>
        </div>
      ) : (
        <div>
          <RHFInput
            control={control}
            name="email"
            label="Email Address"
            type="email"
            autoComplete="email"
          />
          {showWorkEmailNudge ? (
            <p
              id={personaNudgeId}
              role="note"
              aria-live="polite"
              className="mt-2 font-footer-links text-xs text-on-surface-variant"
            >
              Tip: use your work email to make organisation verification simpler later.
            </p>
          ) : null}
        </div>
      )}
      <Controller
        control={control}
        name="phone"
        render={({ field, fieldState }) => (
          <PhoneNumberField
            id="signup-phone"
            defaultCountry={phoneDefaultCountry as import("libphonenumber-js").CountryCode}
            value={field.value ?? { country: phoneDefaultCountry, number: "" }}
            onChange={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message ?? null}
            description="Optional. Used for live bidding updates and fulfilment."
          />
        )}
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
          At least 12 characters — mix letters, numbers, and symbols for a stronger password.
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
