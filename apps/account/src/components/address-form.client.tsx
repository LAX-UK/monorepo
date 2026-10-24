"use client";

import { Button, LoadingButton } from "@/components/account-button";
import { CARD, CARD_PADDING, CARD_TITLE, FIELD } from "@/components/account-ui";
import {
  type AddressFieldErrors,
  type AddressFormValues,
  countryOptions,
  postcodeLabel,
  regionLabel,
  validateAddressForm,
} from "@/server/domain/account-addresses.vm";
import type { AccountAddressInput } from "@auction/identity-contracts/account";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { type ReactNode, useId, useMemo, useState } from "react";

type AddressFormProps = {
  initial: AddressFormValues;
  heading: string;
  submitLabel: string;
  pending: boolean;
  /** A refusal from the issuer, shown above the buttons. */
  error: string | null;
  onSubmit: (input: AccountAddressInput) => void;
  onCancel: () => void;
};

type TextField = Exclude<keyof AddressFormValues, "country">;

/**
 * Add or edit one address. It checks the same rules the issuer applies (postcode shape per
 * country, phone with a country code) so mistakes are caught before a request, and ties each
 * message to its field for screen readers.
 */
export function AddressForm({
  initial,
  heading,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const formId = useId();
  const countries = useMemo(() => countryOptions(), []);
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<AddressFieldErrors>({});

  function set(field: keyof AddressFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function text(
    field: TextField,
    label: string,
    options: { autoComplete: string; hint?: string; type?: string; inputMode?: "tel" } = {
      autoComplete: "off",
    },
  ): ReactNode {
    const id = `${formId}-${field}`;
    const message = errors[field];
    const describedBy = [message ? `${id}-error` : null, options.hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ");
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        <Input
          className={FIELD}
          id={id}
          name={field}
          type={options.type ?? "text"}
          autoComplete={options.autoComplete}
          {...(options.inputMode ? { inputMode: options.inputMode } : {})}
          value={values[field]}
          onChange={(event) => set(field, event.target.value)}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {options.hint ? (
          <p id={`${id}-hint`} className="text-xs text-on-surface-variant">
            {options.hint}
          </p>
        ) : null}
        {message ? (
          <p id={`${id}-error`} className="text-sm text-error">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  const countryId = `${formId}-country`;
  const countryError = errors.country;

  return (
    <form
      aria-labelledby={`${formId}-heading`}
      className={`space-y-4 ${CARD} ${CARD_PADDING}`}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const result = validateAddressForm(values);
        if (!result.ok) {
          setErrors(result.errors);
          return;
        }
        setErrors({});
        onSubmit(result.input);
      }}
    >
      <h3 id={`${formId}-heading`} className={CARD_TITLE}>
        {heading}
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("label", "Name this address", {
          autoComplete: "off",
          hint: "For example Home or Studio.",
        })}
        {text("recipientName", "Full name", { autoComplete: "name" })}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={countryId}>Country</Label>
        <Select value={values.country} onValueChange={(value) => set("country", value)}>
          <SelectTrigger
            id={countryId}
            className={FIELD}
            aria-invalid={countryError ? true : undefined}
            aria-describedby={countryError ? `${countryId}-error` : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {countries.map((country) => (
              <SelectItem key={country.value} value={country.value}>
                {country.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {countryError ? (
          <p id={`${countryId}-error`} className="text-sm text-error">
            {countryError}
          </p>
        ) : null}
      </div>
      {text("line1", "Address line 1", { autoComplete: "address-line1" })}
      {text("line2", "Address line 2 (optional)", { autoComplete: "address-line2" })}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("city", "Town or city", { autoComplete: "address-level2" })}
        {text("region", regionLabel(values.country), { autoComplete: "address-level1" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("postcode", postcodeLabel(values.country), { autoComplete: "postal-code" })}
        {text("phone", "Phone number for the courier (optional)", {
          autoComplete: "tel",
          type: "tel",
          inputMode: "tel",
          hint: "Include the country code, for example +44 7700 900123.",
        })}
      </div>
      <div aria-live="polite">
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <LoadingButton
          type="submit"
          variant="cta"
          loading={pending}
          loadingLabel="Saving…"
          className="min-h-11"
        >
          {submitLabel}
        </LoadingButton>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
