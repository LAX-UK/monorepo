"use client";

import {
  type FactsFormField,
  type FactsFormValues,
  certificateNeedsArrival,
  factsFieldId,
  signatureNeedsPlace,
} from "@/lib/edition-facts-form";
import type { AdminEditionRunSpec } from "@auction/shop-contracts";
import { isOpenRun } from "@auction/shop-domain";
import {
  ChoiceFieldset,
  ChoiceRow,
  EnumSelect,
  Field,
  FieldRow,
  StaffCheckbox,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
} from "@auction/staff-ui";
import type * as React from "react";

type Option<T extends string> = { value: T; label: string };

const SIGNATURES: ReadonlyArray<Option<NonNullable<FactsFormValues["signature"]>>> = [
  { value: "hand_signed", label: "Signed by hand by the artist" },
  { value: "plate_signed", label: "Signature printed in the plate" },
  { value: "estate_stamped", label: "Estate stamp" },
  { value: "estate_signed", label: "Signed by the artist's estate" },
  { value: "unsigned", label: "Not signed" },
];

const NUMBERINGS: ReadonlyArray<Option<NonNullable<FactsFormValues["numbering"]>>> = [
  { value: "on_print", label: "Numbered by hand on the print" },
  { value: "on_certificate", label: "Number on the certificate only" },
  { value: "none", label: "Not numbered" },
];

const MEDIA = [
  { value: "pencil", label: "Pencil" },
  { value: "ink", label: "Ink" },
] as const;
const PLACES = [
  { value: "front_lower_margin", label: "Front, lower margin" },
  { value: "back", label: "Back" },
] as const;
const ISSUERS = [
  { value: "artist", label: "The artist" },
  { value: "publisher", label: "The publisher" },
  { value: "lax", label: "London Art Exchange" },
] as const;
const FORMS = [
  { value: "paper", label: "Paper" },
  { value: "digital", label: "Digital, in LAX Account" },
  { value: "both", label: "Paper and digital" },
] as const;
const ARRIVALS = [
  { value: "with_print", label: "With the print" },
  { value: "separately", label: "Sent separately" },
] as const;

/** Fields that belong to the option above them, indented under it. */
function Nested({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-6.5 flex flex-col gap-3 border-l border-staff-line pl-4">{children}</div>
  );
}

/**
 * Signature, numbering and certificate, with nothing chosen until staff choose it. An open
 * edition's numbering is fixed to "Not numbered", and the other choices say why. Read-only when
 * the facts are locked.
 */
export function EditionFactsFields({
  values,
  errors,
  spec,
  disabled = false,
  onChange,
}: {
  values: FactsFormValues;
  errors: Partial<Record<FactsFormField, string>>;
  spec: AdminEditionRunSpec | null;
  disabled?: boolean;
  onChange: (patch: Partial<FactsFormValues>) => void;
}) {
  const open = spec ? isOpenRun(spec) : false;
  const numbered = values.numbering === "on_print" || values.numbering === "on_certificate";
  return (
    <div className="flex flex-col gap-5">
      <ChoiceFieldset
        legend="Signature"
        id={factsFieldId("signature")}
        error={errors.signature}
        disabled={disabled}
      >
        <StaffRadioGroup
          value={values.signature ?? ""}
          onValueChange={(value) => {
            const signature = value as NonNullable<FactsFormValues["signature"]>;
            onChange({
              signature,
              ...(signature === "hand_signed" ? {} : { medium: null }),
              ...(signatureNeedsPlace(signature) ? {} : { place: null }),
            });
          }}
        >
          {SIGNATURES.map((option) => (
            <div key={option.value} className="flex flex-col gap-2">
              <ChoiceRow
                htmlFor={`facts-signature-${option.value}`}
                control={<StaffRadio id={`facts-signature-${option.value}`} value={option.value} />}
                label={option.label}
                disabled={disabled}
              />
              {values.signature === option.value && signatureNeedsPlace(option.value) ? (
                <Nested>
                  <FieldRow>
                    {option.value === "hand_signed" ? (
                      <Field
                        label="Signed in"
                        error={errors.medium}
                        id={factsFieldId("medium")}
                        disabled={disabled}
                      >
                        <EnumSelect
                          value={values.medium}
                          placeholder="Choose"
                          options={MEDIA}
                          onValueChange={(medium) => onChange({ medium })}
                        />
                      </Field>
                    ) : null}
                    <Field
                      label="Where"
                      error={errors.place}
                      id={factsFieldId("place")}
                      disabled={disabled}
                    >
                      <EnumSelect
                        value={values.place}
                        placeholder="Choose"
                        options={PLACES}
                        onValueChange={(place) => onChange({ place })}
                      />
                    </Field>
                  </FieldRow>
                </Nested>
              ) : null}
            </div>
          ))}
        </StaffRadioGroup>
      </ChoiceFieldset>

      <ChoiceFieldset
        legend="Numbering"
        id={factsFieldId("numbering")}
        error={errors.numbering}
        disabled={disabled}
      >
        <StaffRadioGroup
          value={values.numbering ?? ""}
          onValueChange={(value) =>
            onChange({ numbering: value as NonNullable<FactsFormValues["numbering"]> })
          }
        >
          {NUMBERINGS.map((option) => {
            const blocked = open && option.value !== "none";
            return (
              <ChoiceRow
                key={option.value}
                htmlFor={`facts-numbering-${option.value}`}
                control={
                  <StaffRadio
                    id={`facts-numbering-${option.value}`}
                    value={option.value}
                    disabled={disabled || blocked}
                  />
                }
                label={option.label}
                description={blocked ? "Open editions are not numbered" : undefined}
                disabled={disabled || blocked}
              />
            );
          })}
        </StaffRadioGroup>
      </ChoiceFieldset>

      <ChoiceFieldset
        legend="Certificate"
        id={factsFieldId("certificate")}
        error={errors.certificate}
        disabled={disabled}
      >
        <StaffRadioGroup
          value={values.certificate ?? ""}
          onValueChange={(value) =>
            onChange({ certificate: value === "included" ? "included" : "none" })
          }
        >
          <ChoiceRow
            htmlFor="facts-certificate-none"
            control={<StaffRadio id="facts-certificate-none" value="none" />}
            label="No certificate"
            disabled={disabled}
          />
          <ChoiceRow
            htmlFor="facts-certificate-included"
            control={<StaffRadio id="facts-certificate-included" value="included" />}
            label="Certificate of authenticity"
            disabled={disabled}
          />
        </StaffRadioGroup>
        {values.certificate === "included" ? (
          <Nested>
            <FieldRow>
              <Field
                label="Issued by"
                error={errors.issuer}
                id={factsFieldId("issuer")}
                disabled={disabled}
              >
                <EnumSelect
                  value={values.issuer}
                  placeholder="Choose"
                  options={ISSUERS}
                  onValueChange={(issuer) => onChange({ issuer })}
                />
              </Field>
              <Field label="Form" error={errors.form} id={factsFieldId("form")} disabled={disabled}>
                <EnumSelect
                  value={values.form}
                  placeholder="Choose"
                  options={FORMS}
                  onValueChange={(form) => onChange({ form })}
                />
              </Field>
            </FieldRow>
            {certificateNeedsArrival(values) ? (
              <FieldRow>
                <Field
                  label="Arrives"
                  error={errors.arrives}
                  id={factsFieldId("arrives")}
                  disabled={disabled}
                >
                  <EnumSelect
                    value={values.arrives}
                    placeholder="Choose"
                    options={ARRIVALS}
                    onValueChange={(arrives) => onChange({ arrives })}
                  />
                </Field>
                {values.arrives === "separately" ? (
                  <Field
                    label="Within"
                    error={errors.withinWeeks}
                    id={factsFieldId("withinWeeks")}
                    disabled={disabled}
                  >
                    <TextInput
                      inputMode="numeric"
                      autoComplete="off"
                      value={values.withinWeeksText}
                      trailing={<span className="text-staff-muted">weeks</span>}
                      className="tabular-nums"
                      onChange={(event) => onChange({ withinWeeksText: event.target.value })}
                    />
                  </Field>
                ) : null}
              </FieldRow>
            ) : null}
            {numbered ? (
              <ChoiceRow
                htmlFor="facts-numbered-to-match"
                control={
                  <StaffCheckbox
                    id="facts-numbered-to-match"
                    checked={values.numberedToMatch}
                    disabled={disabled}
                    onCheckedChange={(checked) => onChange({ numberedToMatch: checked === true })}
                  />
                }
                label="Number matches the print"
                description="The certificate carries the same number as the print it comes with."
                disabled={disabled}
              />
            ) : null}
            {numbered && !values.numberedToMatch && values.numbering !== "on_certificate" ? (
              <Field
                label="Why the certificate is not numbered to match"
                error={errors.numberedToMatchReason}
                id={factsFieldId("numberedToMatchReason")}
                disabled={disabled}
              >
                <TextInput
                  value={values.numberedToMatchReason}
                  onChange={(event) => onChange({ numberedToMatchReason: event.target.value })}
                />
              </Field>
            ) : null}
          </Nested>
        ) : null}
      </ChoiceFieldset>
    </div>
  );
}
