"use client";

import type { AddressFieldErrors, AddressValues } from "@/lib/address/address-fields";
import { countriesByName } from "@/lib/ui/countries";
import { Field, SelectMenu, TextInput } from "@auction/ui/lax";
import { useMemo } from "react";

/**
 * The fields of a postal address, shared by every form that takes one: two lines, town, region,
 * postcode and country, with the browser's autofill hints. The form owns the values and checks.
 */
export function AddressFields({
  values,
  onChange,
  errors = {},
  disabled = false,
  autoFocus = false,
}: {
  values: AddressValues;
  onChange: (patch: Partial<AddressValues>) => void;
  errors?: AddressFieldErrors;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const countries = useMemo(() => countriesByName(), []);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Address line 1" error={errors.line1 ?? null} className="md:col-span-2">
        <TextInput
          autoComplete="address-line1"
          autoFocus={autoFocus}
          value={values.line1}
          onChange={(e) => onChange({ line1: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="Address line 2" optional className="md:col-span-2">
        <TextInput
          autoComplete="address-line2"
          value={values.line2}
          onChange={(e) => onChange({ line2: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="Town or city" error={errors.city ?? null}>
        <TextInput
          autoComplete="address-level2"
          value={values.city}
          onChange={(e) => onChange({ city: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="County or region" optional>
        <TextInput
          autoComplete="address-level1"
          value={values.region}
          onChange={(e) => onChange({ region: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="Postcode" error={errors.postalCode ?? null}>
        <TextInput
          autoComplete="postal-code"
          value={values.postalCode}
          onChange={(e) => onChange({ postalCode: e.target.value })}
          disabled={disabled}
        />
      </Field>
      <Field label="Country" error={errors.country ?? null}>
        <SelectMenu
          label="Country"
          value={values.country}
          onValueChange={(country) => onChange({ country })}
          options={countries.map((c) => ({ value: c.code, label: c.name }))}
          disabled={disabled}
          className="w-full"
        />
      </Field>
    </div>
  );
}
