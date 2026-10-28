"use client";

import { EditionFactsFields } from "@/components/artworks/edition-runs/edition-facts-fields.client";
import { FactsPreview } from "@/components/artworks/edition-runs/facts-preview";
import { RunFields } from "@/components/artworks/edition-runs/run-fields.client";
import {
  type FactsFormField,
  type FactsFormValues,
  type FactsPreview as FactsPreviewModel,
  factsFieldId,
} from "@/lib/edition-facts-form";
import type { RunFormField, RunFormValues } from "@/lib/edition-run-form";
import type { AdminEditionRunSpec } from "@auction/shop-contracts";
import { ChoiceRow, FormActions, FormSection, StaffButton, StaffCheckbox } from "@auction/staff-ui";
import type * as React from "react";

/**
 * The run of new prints, first on the page after "What are you adding?": LAX standard by default,
 * a custom limited edition with its allocation, or an open edition; then the proofs kept.
 */
export function PrintsRunSection({
  values,
  errors,
  linkedToOriginal,
  original,
  onChange,
}: {
  values: RunFormValues;
  errors: Partial<Record<RunFormField, string>>;
  linkedToOriginal: boolean;
  original: React.ReactNode;
  onChange: (patch: Partial<RunFormValues>) => void;
}) {
  return (
    <FormSection title="Run" description="Fixed once prints are offered for sale.">
      <RunFields
        values={values}
        errors={errors}
        linkedToOriginal={linkedToOriginal}
        original={original}
        onChange={onChange}
      />
    </FormSection>
  );
}

/**
 * What shoppers are told about every print in the new run, with nothing preselected, beside the
 * "Shoppers will see" preview once the run is valid.
 */
export function PrintsFactsSection({
  values,
  errors,
  spec,
  preview,
  onChange,
}: {
  values: FactsFormValues;
  errors: Partial<Record<FactsFormField, string>>;
  /** The run as chosen above; null while it is not valid. */
  spec: AdminEditionRunSpec | null;
  preview: FactsPreviewModel | null;
  onChange: (patch: Partial<FactsFormValues>) => void;
}) {
  return (
    <FormSection
      title="Edition facts"
      description="What shoppers are told about every print in this run."
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <EditionFactsFields values={values} errors={errors} spec={spec} onChange={onChange} />
        {preview ? (
          <div className="xl:sticky xl:top-20 xl:self-start">
            <FactsPreview preview={preview} />
          </div>
        ) : null}
      </div>
    </FormSection>
  );
}

/**
 * The last section of new prints: what shoppers will see, the check that the facts match the
 * print, and Create draft. The draft is saved whether or not the box is ticked; publishing waits
 * for it.
 */
export function PrintsConfirmSection({
  preview,
  confirmed,
  saving,
  onConfirmedChange,
}: {
  preview: FactsPreviewModel | null;
  confirmed: boolean;
  saving: boolean;
  onConfirmedChange: (confirmed: boolean) => void;
}) {
  return (
    <FormSection
      title="Confirm"
      description="The artwork is saved as a draft either way; publishing waits until the facts are confirmed."
    >
      {preview ? <FactsPreview preview={preview} /> : null}
      <ChoiceRow
        htmlFor={factsFieldId("confirmed")}
        control={
          <StaffCheckbox
            id={factsFieldId("confirmed")}
            checked={confirmed}
            onCheckedChange={(checked) => onConfirmedChange(checked === true)}
          />
        }
        label="I have checked these facts against the print or the publisher's records"
        description="Leave it unticked to save the draft and confirm later."
      />
      <FormActions>
        <StaffButton type="submit" variant="primary" loading={saving}>
          Create draft
        </StaffButton>
      </FormActions>
    </FormSection>
  );
}
