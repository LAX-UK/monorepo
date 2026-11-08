"use client";

import { usePrintParties } from "@/components/artworks/edition-runs/use-print-parties.client";
import {
  type FactsFormField,
  type FactsFormValues,
  PUBLISHED_BY_ARTIST,
  PUBLISHED_BY_LAX,
  certificateNeedsArrival,
  certificateNeedsAuthority,
  factsFieldId,
  publishedByNamedValue,
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
  KeyValueList,
  Notice,
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
const AUTHORITY_GIVERS = [
  { value: "artist", label: "The artist" },
  { value: "estate", label: "The artist's estate" },
] as const;
const STAMPS: ReadonlyArray<Option<FactsFormValues["stamp"]>> = [
  { value: "none", label: "No stamp" },
  { value: "publisher_blind", label: "Blind stamp of the publisher" },
  { value: "printer_blind", label: "Blind stamp of the printer" },
  { value: "estate_back", label: "Estate stamp on the back" },
];
const NOT_STATED = "@none";
const FORMS = [
  { value: "paper", label: "Paper" },
  { value: "digital", label: "Digital, in LAX Account" },
  { value: "both", label: "Paper and digital" },
] as const;
const ARRIVALS = [
  { value: "with_print", label: "With the print" },
  { value: "separately", label: "Sent separately" },
] as const;

const labelOf = <T extends string>(options: ReadonlyArray<Option<T>>, value: T | null) =>
  options.find((option) => option.value === value)?.label ?? null;

function publishedLabel(value: string): string | null {
  if (!value) return null;
  if (value === PUBLISHED_BY_ARTIST) return "The artist";
  if (value === PUBLISHED_BY_LAX) return "London Art Exchange";
  return value.replace(/^name:/, "");
}

/** What is recorded, in the words the form uses, for the read-only view. */
function factsSummary(values: FactsFormValues): Array<{ label: string; value: React.ReactNode }> {
  const signature = [
    labelOf(SIGNATURES, values.signature),
    labelOf(MEDIA, values.medium),
    values.place ? `${labelOf(PLACES, values.place)}` : null,
  ].filter(Boolean);
  const certificate =
    values.certificate === "included"
      ? [
          "Certificate of authenticity",
          labelOf(ISSUERS, values.issuer) && `issued by ${labelOf(ISSUERS, values.issuer)}`,
          labelOf(FORMS, values.form),
          values.arrives === "separately"
            ? `sent separately within ${values.withinWeeksText} weeks`
            : labelOf(ARRIVALS, values.arrives),
        ]
          .filter(Boolean)
          .join(", ")
      : values.certificate === "none"
        ? "No certificate"
        : null;
  const authority =
    values.certificate === "included" && values.issuer === "lax" && values.authorityGivenBy
      ? `${labelOf(AUTHORITY_GIVERS, values.authorityGivenBy)}, letter dated ${values.authorityDatedOn}`
      : null;
  const published = publishedLabel(values.publishedBy);
  return [
    { label: "Signature", value: signature.length ? signature.join(", ") : null },
    { label: "Numbering", value: labelOf(NUMBERINGS, values.numbering) },
    { label: "Certificate", value: certificate },
    ...(authority ? [{ label: "Authority to certify", value: authority }] : []),
    ...(values.stamp !== "none" ? [{ label: "Stamp", value: labelOf(STAMPS, values.stamp) }] : []),
    ...(values.printedBy ? [{ label: "Printed by", value: values.printedBy }] : []),
    ...(published ? [{ label: "Published by", value: published }] : []),
  ];
}

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
  readOnly = false,
  onChange,
}: {
  values: FactsFormValues;
  errors: Partial<Record<FactsFormField, string>>;
  spec: AdminEditionRunSpec | null;
  disabled?: boolean;
  /** Shows what is recorded as label and value pairs, with nothing to change. */
  readOnly?: boolean;
  onChange: (patch: Partial<FactsFormValues>) => void;
}) {
  if (readOnly) return <KeyValueList className="content-start" items={factsSummary(values)} />;
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
            {certificateNeedsAuthority(values) ? (
              <AuthorityToCertify
                values={values}
                errors={errors}
                disabled={disabled}
                onChange={onChange}
              />
            ) : null}
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

      <ChoiceFieldset legend="Stamp" id="facts-stamp" disabled={disabled}>
        <StaffRadioGroup
          value={values.stamp}
          onValueChange={(value) => onChange({ stamp: value as FactsFormValues["stamp"] })}
        >
          {STAMPS.map((option) => (
            <ChoiceRow
              key={option.value}
              htmlFor={`facts-stamp-${option.value}`}
              control={<StaffRadio id={`facts-stamp-${option.value}`} value={option.value} />}
              label={option.label}
              disabled={disabled}
            />
          ))}
        </StaffRadioGroup>
      </ChoiceFieldset>

      <PrintPartyFields values={values} disabled={disabled} onChange={onChange} />
    </div>
  );
}

/**
 * Authority to certify: London Art Exchange issues a certificate only on the written authority
 * of the artist or their estate, so who gave it, the date of the letter and where the signed
 * letter is kept are all needed before the facts can be confirmed. Staff only; shoppers are told
 * only whose authority it is.
 */
function AuthorityToCertify({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: FactsFormValues;
  errors: Partial<Record<FactsFormField, string>>;
  disabled: boolean;
  onChange: (patch: Partial<FactsFormValues>) => void;
}) {
  const invalid = Boolean(
    errors.authorityGivenBy || errors.authorityDatedOn || errors.authorityReference,
  );
  return (
    <fieldset
      className={`flex min-w-0 flex-col gap-3 rounded-staff-md border bg-staff-surface p-4 ${
        invalid ? "border-staff-danger" : "border-staff-line"
      }`}
    >
      <legend className="float-left w-full p-0 text-staff-sm font-semibold text-staff-fg">
        Authority to certify
      </legend>
      <p className="clear-both text-staff-xs text-staff-muted">
        London Art Exchange issues a certificate only on the written authority of the artist or
        their estate.
      </p>
      <FieldRow>
        <Field
          label="Given by"
          error={errors.authorityGivenBy}
          id={factsFieldId("authorityGivenBy")}
          disabled={disabled}
        >
          <EnumSelect
            value={values.authorityGivenBy}
            placeholder="Choose"
            options={AUTHORITY_GIVERS}
            onValueChange={(authorityGivenBy) => onChange({ authorityGivenBy })}
          />
        </Field>
        <Field
          label="Dated"
          error={errors.authorityDatedOn}
          id={factsFieldId("authorityDatedOn")}
          disabled={disabled}
        >
          <TextInput
            type="date"
            autoComplete="off"
            value={values.authorityDatedOn}
            onChange={(event) => onChange({ authorityDatedOn: event.target.value })}
          />
        </Field>
      </FieldRow>
      <Field
        label="Where the signed letter is kept"
        description="A document name, date or filing reference. Staff only; never shown to shoppers."
        error={errors.authorityReference}
        id={factsFieldId("authorityReference")}
        disabled={disabled}
      >
        <TextInput
          autoComplete="off"
          maxLength={200}
          value={values.authorityReference}
          onChange={(event) => onChange({ authorityReference: event.target.value })}
        />
      </Field>
    </fieldset>
  );
}

/**
 * Printed by and Published by, picked from the list kept in Settings so a name is spelled one
 * way. Leaving either empty says nothing. A name already saved but since removed from the list
 * stays selectable, so opening the card never changes what was recorded.
 */
function PrintPartyFields({
  values,
  disabled,
  onChange,
}: {
  values: FactsFormValues;
  disabled: boolean;
  onChange: (patch: Partial<FactsFormValues>) => void;
}) {
  const parties = usePrintParties();
  const listed = parties.status === "ready" ? parties.names : [];
  const printedNames =
    values.printedBy && !listed.includes(values.printedBy) ? [values.printedBy, ...listed] : listed;
  const publishedName = values.publishedBy.startsWith("name:")
    ? values.publishedBy.slice("name:".length)
    : null;
  const publishedNames =
    publishedName && !listed.includes(publishedName) ? [publishedName, ...listed] : listed;
  const hint =
    parties.status === "failed"
      ? "The list could not be loaded. Reload the page to try again."
      : parties.status === "ready" && listed.length === 0
        ? "No names yet. Add them in Settings › Printers and publishers."
        : "Optional. From the list in Settings › Printers and publishers";
  return (
    <div className="flex flex-col gap-3">
      {parties.status === "failed" ? (
        <Notice tone="warning" title="Printers and publishers could not be loaded">
          What is already recorded is kept. Reload the page to choose different names.
        </Notice>
      ) : null}
      <FieldRow>
        <Field label="Printed by" description={hint} id="facts-printedBy" disabled={disabled}>
          <EnumSelect
            value={values.printedBy || NOT_STATED}
            placeholder="Not stated"
            options={[
              { value: NOT_STATED, label: "Not stated" },
              ...printedNames.map((name) => ({ value: name, label: name })),
            ]}
            onValueChange={(name) => onChange({ printedBy: name === NOT_STATED ? "" : name })}
          />
        </Field>
        <Field
          label="Published by"
          description="Optional"
          id="facts-publishedBy"
          disabled={disabled}
        >
          <EnumSelect
            value={values.publishedBy || NOT_STATED}
            placeholder="Not stated"
            options={[
              { value: NOT_STATED, label: "Not stated" },
              { value: PUBLISHED_BY_ARTIST, label: "The artist" },
              { value: PUBLISHED_BY_LAX, label: "London Art Exchange" },
              ...publishedNames.map((name) => ({
                value: publishedByNamedValue(name),
                label: name,
              })),
            ]}
            onValueChange={(value) => onChange({ publishedBy: value === NOT_STATED ? "" : value })}
          />
        </Field>
      </FieldRow>
    </div>
  );
}
