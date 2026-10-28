"use client";

import { AllocationEditor } from "@/components/artworks/edition-runs/allocation-editor.client";
import {
  type ProofsKeptText,
  type RunFormField,
  type RunFormValues,
  type RunTemplate,
  batchSummaryText,
  formNumberingText,
  openSplit,
  proposedBatch,
  runFieldId,
  withTemplate,
} from "@/lib/edition-run-form";
import {
  ChoiceFieldset,
  ChoiceRow,
  Field,
  FieldRow,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
} from "@auction/staff-ui";
import type * as React from "react";

const TEMPLATES: ReadonlyArray<{ value: RunTemplate; label: string; description: string }> = [
  {
    value: "lax_standard",
    label: "LAX standard: limited edition of 24",
    description: "10 for buyers of the original, 10 for the artist, 4 for LAX.",
  },
  {
    value: "custom_limited",
    label: "Custom limited edition",
    description: "Choose the size and who holds the prints.",
  },
  {
    value: "open",
    label: "Open edition",
    description: "No fixed size. Never numbered. Add prints as stock arrives.",
  },
];

const PROOFS: ReadonlyArray<{ key: keyof ProofsKeptText; label: string }> = [
  { key: "ap", label: "Artist's proofs" },
  { key: "pp", label: "Printer's proofs" },
  { key: "hc", label: "Hors commerce" },
  { key: "bat", label: "Bon à tirer" },
];

const CUSTODY = [
  { value: "unprinted", label: "Printed to order" },
  { value: "stored", label: "Already printed" },
] as const;

/** Whether a batch is printed to order or already printed and in storage. */
export function CustodyChoice({
  id,
  value,
  disabled = false,
  onChange,
}: {
  id: string;
  value: "unprinted" | "stored";
  disabled?: boolean;
  onChange: (value: "unprinted" | "stored") => void;
}) {
  return (
    <ChoiceFieldset legend="Prints" id={id} disabled={disabled}>
      <StaffRadioGroup
        value={value}
        className="flex flex-wrap gap-x-5"
        onValueChange={(next) => onChange(next === "stored" ? "stored" : "unprinted")}
      >
        {CUSTODY.map((option) => (
          <ChoiceRow
            key={option.value}
            htmlFor={`${id}-${option.value}`}
            control={<StaffRadio id={`${id}-${option.value}`} value={option.value} />}
            label={option.label}
            disabled={disabled}
          />
        ))}
      </StaffRadioGroup>
    </ChoiceFieldset>
  );
}

/**
 * The run of prints: LAX standard (the default), a custom limited run with its allocation, or an
 * open edition with its default split and first batch; then the proofs kept. Used by step 1 of
 * the create flow and by the editor while the run can still change. `original` is the "Original
 * on lax.art" picker, which buyer prints depend on.
 */
export function RunFields({
  values,
  errors,
  linkedToOriginal,
  original,
  showFirstBatch = true,
  disabled = false,
  onChange,
}: {
  values: RunFormValues;
  errors: Partial<Record<RunFormField, string>>;
  linkedToOriginal: boolean;
  original?: React.ReactNode;
  /** The first batch is asked only when the run is created; later, stock is added from Stock. */
  showFirstBatch?: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<RunFormValues>) => void;
}) {
  const split = openSplit(values);
  const batchCount = Number(values.firstBatchText.trim() || 0);
  const batch =
    split && Number.isInteger(batchCount) && batchCount > 0
      ? proposedBatch(batchCount, split)
      : null;
  const numbering = values.template === "lax_standard" ? formNumberingText(values) : null;

  return (
    <div className="flex flex-col gap-5">
      <ChoiceFieldset legend="Type of run" id={runFieldId("template")} disabled={disabled}>
        <StaffRadioGroup
          value={values.template}
          onValueChange={(template) => onChange(withTemplate(values, template as RunTemplate))}
        >
          {TEMPLATES.map((template) => (
            <ChoiceRow
              key={template.value}
              htmlFor={`run-template-${template.value}`}
              control={<StaffRadio id={`run-template-${template.value}`} value={template.value} />}
              label={template.label}
              description={template.description}
              disabled={disabled}
            />
          ))}
        </StaffRadioGroup>
      </ChoiceFieldset>

      {values.template === "custom_limited" ? (
        <AllocationEditor
          values={values}
          errors={{ size: errors.size, allocation: errors.allocation }}
          linkedToOriginal={linkedToOriginal}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}

      {original}

      {numbering ? (
        <p className="text-staff-sm text-staff-muted">
          {linkedToOriginal ? "Its buyer receives prints 1 to 10. " : ""}
          {numbering}
        </p>
      ) : null}

      {values.template === "open" ? (
        <div className="flex flex-col gap-4">
          <Field
            label="Default split for new stock"
            description={
              split
                ? `Artist ${split.artistPct} %, LAX ${split.laxPct} %. Each batch can change it.`
                : "The artist's share; LAX holds the rest."
            }
            error={errors.openSplit}
            id={runFieldId("openSplit")}
            disabled={disabled}
          >
            <TextInput
              inputMode="numeric"
              autoComplete="off"
              value={values.openArtistPctText}
              leading={<span className="text-staff-muted">Artist</span>}
              trailing={<span className="text-staff-muted">%</span>}
              boxClassName="sm:max-w-48"
              className="text-right tabular-nums"
              onChange={(event) => onChange({ openArtistPctText: event.target.value })}
            />
          </Field>
          {showFirstBatch ? (
            <div className="flex flex-col gap-3">
              <FieldRow>
                <Field
                  label="First batch"
                  optional
                  error={errors.firstBatch}
                  id={runFieldId("firstBatch")}
                  disabled={disabled}
                >
                  <TextInput
                    inputMode="numeric"
                    autoComplete="off"
                    value={values.firstBatchText}
                    trailing={<span className="text-staff-muted">prints</span>}
                    className="tabular-nums"
                    onChange={(event) => onChange({ firstBatchText: event.target.value })}
                  />
                </Field>
                <CustodyChoice
                  id="run-first-batch-custody"
                  value={values.firstBatchCustody}
                  disabled={disabled}
                  onChange={(firstBatchCustody) => onChange({ firstBatchCustody })}
                />
              </FieldRow>
              {values.firstBatchCustody === "stored" && batch ? (
                <Field
                  label="Storage"
                  description="Where the printed stock is kept, such as Plan chest C, drawer 1."
                  error={errors.firstBatchLocation}
                  id={runFieldId("firstBatchLocation")}
                  disabled={disabled}
                >
                  <TextInput
                    value={values.firstBatchLocation}
                    onChange={(event) => onChange({ firstBatchLocation: event.target.value })}
                  />
                </Field>
              ) : null}
              {batch ? (
                <p className="text-staff-sm text-staff-muted">
                  {batchSummaryText({ quantity: batchCount, ...batch, firstStockRef: 1 })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <ChoiceFieldset
        legend="Proofs kept"
        optional
        description="Proofs sit outside the edition. To sell some, create a proof listing after saving."
        id={runFieldId("proofsKept")}
        error={errors.proofsKept}
        disabled={disabled}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PROOFS.map((proof) => (
            <div key={proof.key} className="flex flex-col gap-1.5">
              <label htmlFor={`run-proofs-${proof.key}`} className="text-staff-xs text-staff-muted">
                {proof.label}
              </label>
              <TextInput
                id={`run-proofs-${proof.key}`}
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={values.proofsKept[proof.key]}
                invalid={Boolean(errors.proofsKept)}
                className="tabular-nums"
                onChange={(event) =>
                  onChange({
                    proofsKept: { ...values.proofsKept, [proof.key]: event.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      </ChoiceFieldset>
    </div>
  );
}
