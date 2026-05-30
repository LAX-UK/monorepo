"use client";

import { UnderlineInput } from "@/components/ui/input";
import { Combobox } from "@auction/ui/components/combobox";
import { getPhoneCountryOptions } from "@auction/validators";
import type { PhoneInputValues } from "@auction/validators";
import type { CountryCode } from "libphonenumber-js";
import { isPossiblePhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/mobile";
import { useMemo, useState } from "react";

const countryOptions = getPhoneCountryOptions().map((o) => ({
  value: o.value,
  label: o.label,
  keywords: o.keywords,
}));

export type PhoneNumberFieldProps = {
  id?: string;
  label?: string;
  description?: string;
  defaultCountry: CountryCode;
  value: PhoneInputValues;
  onChange: (value: PhoneInputValues) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string | null;
  "aria-describedby"?: string;
};

export function PhoneNumberField({
  id,
  label = "Phone number (optional)",
  description,
  defaultCountry,
  value,
  onChange,
  onBlur,
  disabled,
  error,
  "aria-describedby": ariaDescribedBy,
}: PhoneNumberFieldProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const describedBy = [ariaDescribedBy, description ? `${id ?? "phone"}-hint` : null]
    .filter(Boolean)
    .join(" ");

  const displayError = error ?? localError;

  const validateBlur = () => {
    const trimmed = value.number.trim();
    if (!trimmed) {
      setLocalError(null);
      onBlur?.();
      return;
    }
    const region = (value.country || defaultCountry) as CountryCode;
    if (!isPossiblePhoneNumber(trimmed, region) && !trimmed.startsWith("+")) {
      setLocalError("Enter a complete phone number for the selected country");
      onBlur?.();
      return;
    }
    const parsed = parsePhoneNumberFromString(
      trimmed,
      trimmed.startsWith("+") ? undefined : region,
    );
    if (!parsed || !isPossiblePhoneNumber(parsed.number, parsed.country)) {
      setLocalError("Enter a valid phone number for the selected country");
    } else {
      setLocalError(null);
    }
    onBlur?.();
  };

  const handleNumberChange = (next: string) => {
    setLocalError(null);
    if (next.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(next);
      if (parsed?.country) {
        onChange({
          country: parsed.country,
          number: parsed.formatNational().replace(/^\s+/, ""),
        });
        return;
      }
    }
    onChange({ ...value, number: next });
  };

  const numberId = useMemo(() => id ?? "phone-number", [id]);

  return (
    <div className="space-y-3">
      <label htmlFor={numberId} className="font-label text-sm font-medium text-on-surface">
        {label}
      </label>
      {description ? (
        <p id={`${numberId}-hint`} className="font-body text-sm text-on-surface-variant">
          {description}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="w-full sm:max-w-[220px]">
          <Combobox
            id={`${numberId}-country`}
            value={value.country || defaultCountry}
            onChange={(country) => {
              setLocalError(null);
              onChange({ ...value, country });
            }}
            options={countryOptions}
            disabled={disabled === true}
            placeholder="Country"
            searchPlaceholder="Search country"
            {...(describedBy ? { "aria-describedby": describedBy } : {})}
            {...(displayError ? { "aria-invalid": true as const } : {})}
          />
        </div>
        <div className="min-w-0 flex-1">
          <UnderlineInput
            id={numberId}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="e.g. 7700 900123"
            value={value.number}
            onChange={(e) => handleNumberChange(e.target.value)}
            onBlur={validateBlur}
            disabled={disabled === true}
            {...(displayError ? { "aria-invalid": true as const } : {})}
            {...(describedBy ? { "aria-describedby": describedBy } : {})}
            className="border-b py-2"
          />
        </div>
      </div>
      {displayError ? (
        <p className="font-body text-sm text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
