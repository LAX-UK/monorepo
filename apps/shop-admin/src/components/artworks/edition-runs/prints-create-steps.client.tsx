"use client";

import { EditionFactsFields } from "@/components/artworks/edition-runs/edition-facts-fields.client";
import { FactsPreview } from "@/components/artworks/edition-runs/facts-preview";
import { RunFields } from "@/components/artworks/edition-runs/run-fields.client";
import {
  type FactsFormField,
  type FactsFormValues,
  factsErrorSummary,
  factsFieldId,
  factsPreview,
} from "@/lib/edition-facts-form";
import { type RunFormField, type RunFormValues, runErrorSummary } from "@/lib/edition-run-form";
import type { AdminEditionRunSpec, AdminProofsKept } from "@auction/shop-contracts";
import {
  ChoiceRow,
  FormActions,
  FormErrorSummary,
  FormSection,
  StaffButton,
  StaffCheckbox,
  StepIndicator,
  type WizardStep,
} from "@auction/staff-ui";
import type * as React from "react";

export const PRINTS_STEPS: readonly WizardStep[] = [
  { id: "run", label: "Run" },
  { id: "facts", label: "Edition facts" },
  { id: "confirm", label: "Confirm" },
];

export type PrintsStep = 0 | 1 | 2;

/**
 * The prints part of "New artwork": three short steps on the page, each a form section. Run
 * (LAX standard by default, custom with its allocation, or open), then the edition facts with
 * nothing preselected, then Confirm with what shoppers will see. Continue checks the step; Back
 * keeps what was entered. The draft is created from the last step.
 */
export function PrintsCreateSteps({
  step,
  onStepChange,
  run,
  facts,
  saving,
  failedContinues,
  onContinue,
}: {
  step: PrintsStep;
  onStepChange: (step: PrintsStep) => void;
  run: {
    values: RunFormValues;
    errors: Partial<Record<RunFormField, string>>;
    linkedToOriginal: boolean;
    original: React.ReactNode;
    proofsKept: AdminProofsKept;
    onChange: (patch: Partial<RunFormValues>) => void;
  };
  facts: {
    values: FactsFormValues;
    errors: Partial<Record<FactsFormField, string>>;
    /** The run as chosen in step 1; null until it is valid. */
    spec: AdminEditionRunSpec | null;
    onChange: (patch: Partial<FactsFormValues>) => void;
  };
  saving: boolean;
  /** Failed Continue presses so far, so each failure moves focus to its summary. */
  failedContinues: number;
  onContinue: () => void;
}) {
  const preview = facts.spec ? factsPreview(facts.values, facts.spec, run.proofsKept) : null;
  const back = (to: PrintsStep) => (
    <StaffButton
      type="button"
      variant="secondary"
      disabled={saving}
      onClick={() => onStepChange(to)}
    >
      Back
    </StaffButton>
  );
  return (
    <div className="flex flex-col gap-6">
      <StepIndicator
        steps={PRINTS_STEPS}
        currentIndex={step}
        label="New prints"
        disabled={saving}
        onStepClick={(index) => onStepChange(index as PrintsStep)}
      />
      {step === 0 ? (
        <FormSection title="Run" description="Step 1 of 3. Fixed once prints are offered for sale.">
          <FormErrorSummary errors={runErrorSummary(run.errors)} focusKey={failedContinues} />
          <RunFields
            values={run.values}
            errors={run.errors}
            linkedToOriginal={run.linkedToOriginal}
            original={run.original}
            onChange={run.onChange}
          />
          <FormActions>
            <StaffButton type="button" variant="primary" onClick={onContinue}>
              Continue
            </StaffButton>
          </FormActions>
        </FormSection>
      ) : null}
      {step === 1 ? (
        <FormSection
          title="Edition facts"
          description="Step 2 of 3. What shoppers are told about every print in this run."
        >
          <FormErrorSummary errors={factsErrorSummary(facts.errors)} focusKey={failedContinues} />
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <EditionFactsFields
              values={facts.values}
              errors={facts.errors}
              spec={facts.spec}
              onChange={facts.onChange}
            />
            {preview ? (
              <div className="xl:sticky xl:top-20 xl:self-start">
                <FactsPreview preview={preview} />
              </div>
            ) : null}
          </div>
          <FormActions>
            {back(0)}
            <StaffButton type="button" variant="primary" onClick={onContinue}>
              Continue
            </StaffButton>
          </FormActions>
        </FormSection>
      ) : null}
      {step === 2 ? (
        <FormSection
          title="Confirm"
          description="Step 3 of 3. The artwork is saved as a draft either way; publishing waits until the facts are confirmed."
        >
          {preview ? <FactsPreview preview={preview} /> : null}
          <ChoiceRow
            htmlFor={factsFieldId("confirmed")}
            control={
              <StaffCheckbox
                id={factsFieldId("confirmed")}
                checked={facts.values.confirmed}
                onCheckedChange={(checked) => facts.onChange({ confirmed: checked === true })}
              />
            }
            label="I have checked these facts against the print or the publisher's records"
            description="Leave it unticked to save the draft and confirm later."
          />
          <FormActions>
            {back(1)}
            <StaffButton type="submit" variant="primary" loading={saving}>
              Create draft
            </StaffButton>
          </FormActions>
        </FormSection>
      ) : null}
    </div>
  );
}
