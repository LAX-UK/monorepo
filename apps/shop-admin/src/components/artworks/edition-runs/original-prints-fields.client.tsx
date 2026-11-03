"use client";

import { RunFields } from "@/components/artworks/edition-runs/run-fields.client";
import {
  type OriginalPrintsField,
  type OriginalPrintsFormValues,
  originalPrintsFieldId,
} from "@/lib/original-prints-form";
import { Field, TextInput } from "@auction/staff-ui";

/**
 * What staff choose for the prints of an original: the Shop title, which follows the original's
 * until they type their own, and the run (LAX standard to start with). Buyers of the original are
 * known, so a custom run can give prints to them. Shared by the "Also create prints" section of a
 * new original and the "Create prints" dialog of a saved one.
 */
export function OriginalPrintsFields({
  values,
  errors,
  originalTitle,
  disabled = false,
  onChange,
}: {
  values: OriginalPrintsFormValues;
  errors: Partial<Record<OriginalPrintsField, string>>;
  originalTitle: string;
  disabled?: boolean;
  onChange: (patch: Partial<OriginalPrintsFormValues>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Shop title"
        description="Shown on LAX Shop. It starts as the original's title."
        error={errors.title}
        id={originalPrintsFieldId("title")}
        disabled={disabled}
      >
        <TextInput
          value={values.titleOverride ?? originalTitle}
          autoComplete="off"
          onChange={(event) => onChange({ titleOverride: event.target.value })}
        />
      </Field>
      <RunFields
        values={values.run}
        errors={errors}
        linkedToOriginal
        disabled={disabled}
        onChange={(patch) => onChange({ run: { ...values.run, ...patch } })}
      />
    </div>
  );
}
