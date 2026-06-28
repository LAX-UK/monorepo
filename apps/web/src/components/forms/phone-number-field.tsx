"use client";

import { cn } from "@auction/ui";
import { Combobox } from "@auction/ui/components/combobox";
import { getPhoneCountryOptions } from "@auction/validators";
import type { PhoneInputValues } from "@auction/validators";
import type { CountryCode } from "libphonenumber-js";
import { isPossiblePhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js/mobile";
import { useMemo, useState } from "react";

const countryOptions = getPhoneCountryOptions().map((o) => ({
  value: o.value,
  label: o.label,
  shortLabel: o.callingCode,
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
  /** Auth sign-in: floating label + unified underline row matching password field. */
  variant?: "default" | "auth";
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
  variant = "default",
  "aria-describedby": ariaDescribedBy,
}: PhoneNumberFieldProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const describedBy = [ariaDescribedBy, description ? `${id ?? "phone"}-hint` : null]
    .filter(Boolean)
    .join(" ");

  const displayError = error ?? localError;
  const numberId = useMemo(() => id ?? "phone-number", [id]);
  const countryId = `${numberId}-country`;
  // Auth row always shows the dial-code picker — keep the label shrunken above the row
  // so it never collides with "+44".
  const floatLabel = variant === "auth" ? true : focused || value.number.trim().length > 0;

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

  const countryPicker = (
    <Combobox
      id={countryId}
      compact
      value={value.country || defaultCountry}
      onChange={(country) => {
        setLocalError(null);
        onChange({ ...value, country });
      }}
      options={countryOptions}
      disabled={disabled === true}
      placeholder="Country"
      searchPlaceholder="Search country or code"
      aria-label="Country code"
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      {...(displayError ? { "aria-invalid": true as const } : {})}
    />
  );

  const numberInput = (
    <input
      id={numberId}
      type="tel"
      inputMode="tel"
      autoComplete={variant === "auth" ? "off" : "tel-national"}
      name={variant === "auth" ? "phone" : undefined}
      placeholder={variant === "auth" ? "7700 900123" : "e.g. 7700 900123"}
      value={value.number}
      onChange={(e) => handleNumberChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        validateBlur();
      }}
      disabled={disabled === true}
      {...(displayError ? { "aria-invalid": true as const } : {})}
      {...(describedBy ? { "aria-describedby": describedBy } : {})}
      className={cn(
        "min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-on-surface-variant/60 focus-visible:outline-none disabled:cursor-not-allowed",
        variant === "auth"
          ? cn(
              "pb-1 font-footer-links text-base leading-6 tracking-[0.5px] text-on-surface",
              !floatLabel && "placeholder:text-transparent",
            )
          : "py-2 font-body text-sm text-on-surface",
      )}
    />
  );

  const phoneRow = (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {countryPicker}
      <span className="h-4 w-px shrink-0 bg-outline-variant/50" aria-hidden />
      {numberInput}
    </div>
  );

  if (variant === "auth") {
    return (
      <div className="w-full">
        <div
          className={cn(
            "relative rounded-t border-b border-input-border bg-transparent transition-colors focus-within:border-input-border-focus",
            displayError ? "border-error focus-within:border-error" : "",
            disabled ? "opacity-60" : "",
          )}
        >
          <label
            htmlFor={numberId}
            className={cn(
              "pointer-events-none absolute left-0 font-footer-links text-on-surface-variant transition-all duration-150",
              floatLabel
                ? "top-0 text-xs leading-[18px] tracking-[0.16px]"
                : "top-4 text-base leading-6 tracking-[0.5px]",
            )}
          >
            {label}
          </label>
          <div className="flex items-end gap-2 pt-5 pb-2">{phoneRow}</div>
        </div>
        {displayError ? (
          <p className="mt-1 font-footer-links text-xs text-error" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={numberId} className="font-label text-sm font-medium text-on-surface">
        {label}
      </label>
      {description ? (
        <p id={`${numberId}-hint`} className="font-body text-sm text-on-surface-variant">
          {description}
        </p>
      ) : null}
      <div
        className={cn(
          "flex min-h-11 items-center rounded-md border bg-surface-container-lowest px-3 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
          displayError
            ? "border-destructive focus-within:border-destructive focus-within:ring-destructive/20"
            : "border-outline-variant/30",
          disabled ? "opacity-60" : "",
        )}
      >
        {phoneRow}
      </div>
      {displayError ? (
        <p className="font-body text-sm text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}
